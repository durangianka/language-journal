"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function HeaderMenu({
  label,
  settingsLabel,
  trashLabel,
}: {
  label: string;
  settingsLabel: string;
  trashLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-lg" className="size-11" aria-label={label} />}
      >
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings" />} className="min-h-11 min-w-11">
            {settingsLabel}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/trash" />} className="min-h-11 min-w-11">
            {trashLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
