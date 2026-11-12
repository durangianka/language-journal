"use client";

import { useEffect, useRef } from "react";

/** Protect the writing surface, including interface-language submissions. */
export function useUnsavedWriting(dirty: boolean, message: string) {
  const saved = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    function confirmLeave() {
      return saved.current || window.confirm(message);
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (saved.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const target = new URL(link.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      } else saved.current = true;
    }
    function submit(event: SubmitEvent) {
      if (
        !(event.target instanceof HTMLFormElement) ||
        event.target.classList.contains("writing-form")
      )
        return;
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      } else saved.current = true;
    }
    function traverse(event: Event) {
      if (!("navigationType" in event) || event.navigationType !== "traverse" || !event.cancelable)
        return;
      if (!confirmLeave()) event.preventDefault();
      else saved.current = true;
    }
    // The Navigation API can cancel same-document browser Back and Forward before React navigates.
    const navigation = "navigation" in window ? window.navigation : null;
    if (
      navigation &&
      typeof navigation === "object" &&
      "addEventListener" in navigation &&
      typeof navigation.addEventListener === "function"
    ) {
      navigation.addEventListener("navigate", traverse);
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", submit, true);
      if (
        navigation &&
        typeof navigation === "object" &&
        "removeEventListener" in navigation &&
        typeof navigation.removeEventListener === "function"
      )
        navigation.removeEventListener("navigate", traverse);
    };
  }, [dirty, message]);
  return () => {
    saved.current = true;
  };
}
