import { useState } from "react";
import { GripVertical, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  useAdminListCmsMenus, getAdminListCmsMenusQueryKey,
  useAdminPutCmsMenuItems,
} from "@workspace/api-client-react";
import type { CmsMenuItem } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DraftItem {
  /** Stable client-side ID for DnD (string so new items can use a temp value) */
  dndId: string;
  label: string;
  url: string;
  isHidden: boolean;
  /** Index of the parent in the current items array, or null for top-level */
  parentIndex: number | null;
}

function toDraft(items: CmsMenuItem[]): DraftItem[] {
  // Build a flat ordered array: for each top-level item, immediately followed by its children.
  const topLevel = items.filter((i) => i.parentId === null || i.parentId === undefined);
  const children = items.filter((i) => i.parentId !== null && i.parentId !== undefined);

  const flat: DraftItem[] = [];
  for (const parent of topLevel) {
    const parentIndex = flat.length;
    flat.push({ dndId: String(parent.id), label: parent.label, url: parent.url, isHidden: parent.isHidden, parentIndex: null });
    for (const child of children.filter((c) => c.parentId === parent.id)) {
      flat.push({ dndId: String(child.id), label: child.label, url: child.url, isHidden: child.isHidden, parentIndex });
    }
  }
  // Orphaned children (parent not found) fall back to top-level.
  for (const orphan of children.filter((c) => !topLevel.some((p) => p.id === c.parentId))) {
    flat.push({ dndId: String(orphan.id), label: orphan.label, url: orphan.url, isHidden: orphan.isHidden, parentIndex: null });
  }
  return flat;
}

function SortableItem({
  item,
  itemIndex,
  allItems,
  onChange,
  onDelete,
}: {
  item: DraftItem;
  itemIndex: number;
  allItems: DraftItem[];
  onChange: (dndId: string, field: keyof DraftItem, value: string | boolean | number | null) => void;
  onDelete: (dndId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.dndId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const topLevelOptions = allItems
    .map((other, i) => ({ other, i }))
    .filter(({ other, i }) => i !== itemIndex && other.parentIndex === null);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-background border border-border rounded-lg ${item.parentIndex !== null ? "ml-6" : ""}`}
    >
      <button
        type="button"
        className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing p-1 shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onChange(item.dndId, "label", e.target.value)}
        placeholder="Label"
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <input
        type="text"
        value={item.url}
        onChange={(e) => onChange(item.dndId, "url", e.target.value)}
        placeholder="URL or /path"
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <select
        value={item.parentIndex ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(item.dndId, "parentIndex", val === "" ? null : Number(val));
        }}
        className="min-w-[110px] px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
        title="Parent item"
      >
        <option value="">Top level</option>
        {topLevelOptions.map(({ other, i }) => (
          <option key={i} value={i}>
            ↳ {other.label || `Item ${i + 1}`}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(item.dndId, "isHidden", !item.isHidden)}
        title={item.isHidden ? "Show item" : "Hide item"}
        className={`p-1.5 rounded transition-colors shrink-0 ${item.isHidden ? "text-muted-foreground/40 hover:text-foreground" : "text-foreground hover:text-muted-foreground"}`}
      >
        {item.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.dndId)}
        className="p-1.5 rounded text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

interface MenuEditorProps {
  name: string;
  label: string;
  initialItems: CmsMenuItem[];
}

function MenuEditor({ name, label, initialItems }: MenuEditorProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [items, setItems] = useState<DraftItem[]>(() => toDraft(initialItems));
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const putItems = useAdminPutCmsMenuItems({
    mutation: {
      onSuccess: () => {
        toast({ title: `${label} menu saved` });
        qc.invalidateQueries({ queryKey: getAdminListCmsMenusQueryKey() });
      },
      onError: () => toast({ title: "Failed to save menu", variant: "destructive" }),
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIdx = prev.findIndex((i) => i.dndId === active.id);
        const newIdx = prev.findIndex((i) => i.dndId === over.id);
        const moved = arrayMove(prev, oldIdx, newIdx);
        // Fix up parentIndex references after the reorder.
        return moved.map((item) => {
          if (item.parentIndex === null) return item;
          // Find what dndId the parent had before and remap to new index.
          const parentDndId = prev[item.parentIndex]?.dndId;
          if (!parentDndId) return { ...item, parentIndex: null };
          const newParentIndex = moved.findIndex((i) => i.dndId === parentDndId);
          return { ...item, parentIndex: newParentIndex === -1 ? null : newParentIndex };
        });
      });
    }
  };

  const handleChange = (dndId: string, field: keyof DraftItem, value: string | boolean | number | null) => {
    setItems((prev) => prev.map((i) => (i.dndId === dndId ? { ...i, [field]: value } : i)));
  };

  const handleDelete = (dndId: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.dndId === dndId);
      const next = prev.filter((_, i) => i !== idx);
      // Fix parentIndex references.
      return next.map((item) => {
        if (item.parentIndex === null) return item;
        if (item.parentIndex === idx) return { ...item, parentIndex: null };
        if (item.parentIndex > idx) return { ...item, parentIndex: item.parentIndex - 1 };
        return item;
      });
    });
  };

  const handleAdd = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    setItems((prev) => [
      ...prev,
      { dndId: `new-${Date.now()}`, label: newLabel.trim(), url: newUrl.trim(), isHidden: false, parentIndex: null },
    ]);
    setNewLabel("");
    setNewUrl("");
  };

  const handleSave = () => {
    const valid = items.filter((i) => i.label.trim() && i.url.trim());
    // parentIndex values may have changed if items were filtered; remap.
    const validDndIds = new Set(valid.map((i) => i.dndId));
    const remapped = valid.map((item) => {
      if (item.parentIndex === null) return item;
      const parentDndId = items[item.parentIndex]?.dndId;
      if (!parentDndId || !validDndIds.has(parentDndId)) return { ...item, parentIndex: null };
      const newIdx = valid.findIndex((i) => i.dndId === parentDndId);
      return { ...item, parentIndex: newIdx === -1 ? null : newIdx };
    });

    putItems.mutate({
      name,
      data: {
        items: remapped.map((i) => ({
          label: i.label,
          url: i.url,
          isHidden: i.isHidden,
          parentIndex: i.parentIndex ?? null,
        })),
      },
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4">{label} Navigation</h2>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.dndId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 mb-4">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No items yet. Add one below.</p>
            )}
            {items.map((item, idx) => (
              <SortableItem
                key={item.dndId}
                item={item}
                itemIndex={idx}
                allItems={items}
                onChange={handleChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2 items-center mb-4 pt-2 border-t border-border">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="URL or /path"
          className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newLabel.trim() || !newUrl.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={putItems.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {putItems.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save {label} Menu
        </button>
      </div>
    </div>
  );
}

export default function CmsMenus() {
  const { data: menus, isLoading, isError } = useAdminListCmsMenus({
    query: { queryKey: getAdminListCmsMenusQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load menus. Please refresh.
      </div>
    );
  }

  const header = menus?.find((m) => m.name === "header");
  const footer = menus?.find((m) => m.name === "footer");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Navigation Menus</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage the header and footer navigation links. Use the "↳ Parent" dropdown to nest items under a top-level link.</p>
      </div>
      <div className="space-y-6">
        {header && (
          <MenuEditor name="header" label="Header" initialItems={header.items} />
        )}
        {footer && (
          <MenuEditor name="footer" label="Footer" initialItems={footer.items} />
        )}
      </div>
    </div>
  );
}
