"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { initialState, reducer, type DataAction, type DataState } from "@/data/store";

interface DataContextValue {
  state: DataState;
  dispatch: Dispatch<DataAction>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <DataContext.Provider value={{ state, dispatch }}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
  const context = useContext(DataContext);
  if (context === null) {
    throw new Error("useDataContext must be used within a DataProvider");
  }

  return context;
}
