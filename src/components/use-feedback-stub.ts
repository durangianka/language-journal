"use client";

import { useSyncExternalStore } from "react";
import {
  getServerStubSnapshot,
  getStubSnapshot,
  parseStubState,
  subscribeToStub,
} from "@/lib/feedback-client";

export function useFeedbackStub() {
  return parseStubState(
    useSyncExternalStore(subscribeToStub, getStubSnapshot, getServerStubSnapshot),
  );
}
