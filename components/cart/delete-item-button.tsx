"use client";

import { CartItem } from "lib/sfcc/types";
import { Trash2 } from "lucide-react";

export function DeleteItemButton({
  item,
  optimisticUpdate,
}: {
  item: CartItem;
  optimisticUpdate: (merchandiseId: string, updateType: "delete") => void;
}) {
  const merchandiseId = item.merchandise.id;

  return (
    <button
      type="button"
      aria-label="Remove cart item"
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
      onClick={() => optimisticUpdate(merchandiseId, "delete")}
    >
      <span className="text-[11px] font-medium">Remove</span>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
