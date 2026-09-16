"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import type { ActionResult } from "@/lib/action-result";

interface ListFormProps {
  items: { id: string; label: ReactNode; detail?: ReactNode }[];
  placeholder: string;
  inputType?: string;
  addLabel: string;
  removeLabel: string;
  emptyLabel: string;
  onAdd: (value: string) => Promise<ActionResult>;
  onRemove: (id: string) => Promise<ActionResult>;
}

/** A small "add a value / remove a row" editor used for members and repositories. */
export function ListForm(props: ListFormProps) {
  const [value, setValue] = useState("");
  const { pending, run } = useAction();

  return (
    <div className="grid gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => props.onAdd(value), { onSuccess: () => setValue("") });
        }}
      >
        <Input
          type={props.inputType ?? "text"}
          required
          placeholder={props.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          <PlusIcon />
          <span className="hidden sm:inline">{props.addLabel}</span>
        </Button>
      </form>
      {props.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.emptyLabel}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {props.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm">{item.label}</div>
                {item.detail ? <div className="truncate text-xs text-muted-foreground">{item.detail}</div> : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={props.removeLabel}
                disabled={pending}
                onClick={() => run(() => props.onRemove(item.id))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
