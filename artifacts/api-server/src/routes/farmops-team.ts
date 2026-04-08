import "../types/session.d.ts";
import { Router, type IRouter } from "express";
import { eq, and, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "node:crypto";
import {
  db,
  farmopsUsersTable,
  farmopsInvitationsTable,
  farmopsTenantsTable,
} from "@workspace/db";
import { requireFarmopsTenant } from "../middlewares/require-farmops-tenant.js";
import { requireFarmopsRole } from "../middlewares/require-farmops-role.js";
import { sendEmail } from "../lib/email.js";

const router: IRouter = Router();

function farmopsBaseUrl(): string {
  return (
    process.env.FARMOPS_BASE_URL ??
    `https://${process.env.REPLIT_DEV_DOMAIN}/farmops`
  );
}

// ── GET /farmops/team/members ─────────────────────────────────────────────────
// List all users for the tenant. Any authenticated user.

router.get("/farmops/team/members", requireFarmopsTenant, async (req, res): Promise<void> => {
  const tenantId = req.farmopsTenant!.id;

  const members = await db
    .select({
      id: farmopsUsersTable.id,
      name: farmopsUsersTable.name,
      email: farmopsUsersTable.email,
      role: farmopsUsersTable.role,
      emailVerified: farmopsUsersTable.emailVerified,
      lastLoginAt: farmopsUsersTable.lastLoginAt,
      createdAt: farmopsUsersTable.createdAt,
    })
    .from(farmopsUsersTable)
    .where(eq(farmopsUsersTable.tenantId, tenantId))
    .orderBy(farmopsUsersTable.createdAt);

  res.json(members);
});

// ── POST /farmops/team/invite ─────────────────────────────────────────────────
// Send an invitation email. Admin or owner.

const inviteBody = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

router.post(
  "/farmops/team/invite",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = inviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const tenantId = req.farmopsTenant!.id;
    const invitedByUserId = req.farmopsUser!.id;
    const { email, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if email is already a member
    const [existing] = await db
      .select({ id: farmopsUsersTable.id })
      .from(farmopsUsersTable)
      .where(
        and(
          eq(farmopsUsersTable.tenantId, tenantId),
          eq(farmopsUsersTable.email, normalizedEmail)
        )
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "This person is already a member of your team." });
      return;
    }

    // Remove any existing pending invite for this email+tenant
    await db
      .delete(farmopsInvitationsTable)
      .where(
        and(
          eq(farmopsInvitationsTable.tenantId, tenantId),
          eq(farmopsInvitationsTable.email, normalizedEmail),
          isNull(farmopsInvitationsTable.acceptedAt)
        )
      );

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(farmopsInvitationsTable)
      .values({
        tenantId,
        email: normalizedEmail,
        role,
        token,
        invitedByUserId,
        expiresAt,
      })
      .returning();

    // Fetch tenant name for the email
    const [tenant] = await db
      .select({ name: farmopsTenantsTable.name })
      .from(farmopsTenantsTable)
      .where(eq(farmopsTenantsTable.id, tenantId))
      .limit(1);

    const inviteUrl = `${farmopsBaseUrl()}/accept-invite?token=${token}`;
    const tenantName = tenant?.name ?? "JP FarmOps";

    await sendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join ${tenantName} on JP FarmOps`,
      text: [
        `You've been invited to join ${tenantName} on JP FarmOps as a team ${role}.`,
        "",
        `Accept your invitation: ${inviteUrl}`,
        "",
        "This link expires in 7 days.",
      ].join("\n"),
      html: [
        `<p>You've been invited to join <strong>${tenantName}</strong> on JP FarmOps as a team <strong>${role}</strong>.</p>`,
        `<p><a href="${inviteUrl}">Accept your invitation</a></p>`,
        `<p style="color:#6b7280;font-size:0.875rem;">This link expires in 7 days.</p>`,
      ].join(""),
    });

    // Return invitation without the token
    const { token: _t, ...safeInvitation } = invitation;
    res.status(201).json(safeInvitation);
  }
);

// ── GET /farmops/team/invitations ─────────────────────────────────────────────
// List pending (un-accepted, non-expired) invitations. Admin or owner.

router.get(
  "/farmops/team/invitations",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const now = new Date();

    const invitations = await db
      .select({
        id: farmopsInvitationsTable.id,
        email: farmopsInvitationsTable.email,
        role: farmopsInvitationsTable.role,
        invitedByUserId: farmopsInvitationsTable.invitedByUserId,
        expiresAt: farmopsInvitationsTable.expiresAt,
        createdAt: farmopsInvitationsTable.createdAt,
      })
      .from(farmopsInvitationsTable)
      .where(
        and(
          eq(farmopsInvitationsTable.tenantId, tenantId),
          isNull(farmopsInvitationsTable.acceptedAt),
          gt(farmopsInvitationsTable.expiresAt, now)
        )
      )
      .orderBy(farmopsInvitationsTable.createdAt);

    res.json(invitations);
  }
);

// ── DELETE /farmops/team/invitations/:id ─────────────────────────────────────
// Cancel a pending invitation. Admin or owner.

router.delete(
  "/farmops/team/invitations/:id",
  requireFarmopsTenant,
  requireFarmopsRole("admin"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid invitation ID" });
      return;
    }

    const [deleted] = await db
      .delete(farmopsInvitationsTable)
      .where(
        and(
          eq(farmopsInvitationsTable.id, id),
          eq(farmopsInvitationsTable.tenantId, tenantId)
        )
      )
      .returning({ id: farmopsInvitationsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    res.json({ message: "Invitation cancelled" });
  }
);

// ── PATCH /farmops/team/members/:id/role ─────────────────────────────────────
// Change a team member's role. Owner only.

const roleBody = z.object({
  role: z.enum(["admin", "member"]),
});

router.patch(
  "/farmops/team/members/:id/role",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const requestingUserId = req.farmopsUser!.id;
    const targetId = parseInt(String(req.params.id), 10);
    if (isNaN(targetId)) {
      res.status(400).json({ error: "Invalid member ID" });
      return;
    }

    if (targetId === requestingUserId) {
      res.status(400).json({ error: "You cannot change your own role." });
      return;
    }

    const parsed = roleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid role" });
      return;
    }

    // Verify target belongs to this tenant and is not an owner
    const [target] = await db
      .select({ id: farmopsUsersTable.id, role: farmopsUsersTable.role })
      .from(farmopsUsersTable)
      .where(
        and(
          eq(farmopsUsersTable.id, targetId),
          eq(farmopsUsersTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot change the role of another owner." });
      return;
    }

    const [updated] = await db
      .update(farmopsUsersTable)
      .set({ role: parsed.data.role })
      .where(eq(farmopsUsersTable.id, targetId))
      .returning({
        id: farmopsUsersTable.id,
        name: farmopsUsersTable.name,
        email: farmopsUsersTable.email,
        role: farmopsUsersTable.role,
      });

    res.json(updated);
  }
);

// ── DELETE /farmops/team/members/:id ─────────────────────────────────────────
// Remove a team member. Owner only.

router.delete(
  "/farmops/team/members/:id",
  requireFarmopsTenant,
  requireFarmopsRole("owner"),
  async (req, res): Promise<void> => {
    const tenantId = req.farmopsTenant!.id;
    const requestingUserId = req.farmopsUser!.id;
    const targetId = parseInt(String(req.params.id), 10);
    if (isNaN(targetId)) {
      res.status(400).json({ error: "Invalid member ID" });
      return;
    }

    if (targetId === requestingUserId) {
      res.status(400).json({ error: "You cannot remove yourself from the team." });
      return;
    }

    // Verify target belongs to this tenant and is not an owner
    const [target] = await db
      .select({ id: farmopsUsersTable.id, role: farmopsUsersTable.role })
      .from(farmopsUsersTable)
      .where(
        and(
          eq(farmopsUsersTable.id, targetId),
          eq(farmopsUsersTable.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (target.role === "owner") {
      res.status(400).json({ error: "Cannot remove another owner from the team." });
      return;
    }

    await db
      .delete(farmopsUsersTable)
      .where(eq(farmopsUsersTable.id, targetId));

    res.json({ message: "Member removed" });
  }
);

export default router;
