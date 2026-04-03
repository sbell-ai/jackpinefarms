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
  id: string;
  label: string;
  url: string;
  isHidden: boolean;
}

function toDraft(items: CmsMenuItem[]): DraftItem[] {
  return items.map((i) => ({
    id: String(i.id),
    label: i.label,
    url: i.url,
    isHidden: i.isHidden,
  }));
}

function SortableItem({
  item,
  onChange,
  onDelete,
}: {
  item: DraftItem;
  onChange: (id: string, field: keyof DraftItem, value: string | boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-background border border-border rounded-lg"
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
        onChange={(e) => onChange(item.id, "label", e.target.value)}
        placeholder="Label"
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <input
        type="text"
        value={item.url}
        onChange={(e) => onChange(item.id, "url", e.target.value)}
        placeholder="URL or /path"
        className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <button
        type="button"
        onClick={() => onChange(item.id, "isHidden", !item.isHidden)}
        title={item.isHidden ? "Show item" : "Hide item"}
        className={`p-1.5 rounded transition-colors shrink-0 ${item.isHidden ? "text-muted-foreground/40 hover:text-foreground" : "text-foreground hover:text-muted-foreground"}`}
      >
        {item.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
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
        const oldIdx = prev.findIndex((i) => i.id === active.id);
        const newIdx = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const handleChange = (id: string, field: keyof DraftItem, value: string | boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAdd = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, label: newLabel.trim(), url: newUrl.trim(), isHidden: false },
    ]);
    setNewLabel("");
    setNewUrl("");
  };

  const handleSave = () => {
    const valid = items.filter((i) => i.label.trim() && i.url.trim());
    putItems.mutate({
      name,
      data: {
        items: valid.map((i) => ({ label: i.label, url: i.url, isHidden: i.isHidden })),
      },
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4">{label} Navigation</h2>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 mb-4">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No items yet. Add one below.</p>
            )}
            {items.map((item) => (
              <SortableItem key={item.id} item={item} onChange={handleChange} onDelete={handleDelete} />
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
        <p className="text-sm text-muted-foreground mt-1">Manage the header and footer navigation links</p>
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
