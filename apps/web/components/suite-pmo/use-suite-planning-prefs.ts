"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadColVisible,
  loadColWidths,
  loadGanttListCols,
  loadSavedViews,
  loadViewOpts,
  saveColVisible,
  saveColWidths,
  saveGanttListCols,
  saveSavedViews,
  saveViewOpts,
  type GanttListColumnId,
  type PlanningColumnId,
  type SavedPlanningView,
} from "../../lib/suite-planning-persisted-view";

export function useSuitePlanningPrefs() {
  const [colWidths, setColWidths] = useState(loadColWidths);
  const [colVisible, setColVisible] = useState(loadColVisible);
  const [viewOpts, setViewOpts] = useState(loadViewOpts);
  const [savedViews, setSavedViews] = useState(loadSavedViews);
  const [ganttListCols, setGanttListCols] = useState(loadGanttListCols);

  useEffect(() => {
    saveColWidths(colWidths);
  }, [colWidths]);

  useEffect(() => {
    saveColVisible(colVisible);
  }, [colVisible]);

  useEffect(() => {
    saveViewOpts(viewOpts);
  }, [viewOpts]);

  useEffect(() => {
    saveSavedViews(savedViews);
  }, [savedViews]);

  useEffect(() => {
    saveGanttListCols(ganttListCols);
  }, [ganttListCols]);

  const onWidthChange = useCallback((id: PlanningColumnId, w: number) => {
    setColWidths((prev) => ({ ...prev, [id]: w }));
  }, []);

  const saveView = useCallback(
    (name: string, snapshot: Omit<SavedPlanningView, "id" | "name" | "createdAt">) => {
      const id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const row: SavedPlanningView = {
        id,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        ...snapshot,
      };
      setSavedViews((list) => [row, ...list]);
    },
    [],
  );

  const applyView = useCallback((v: SavedPlanningView) => {
    setColWidths(v.colWidths);
    setColVisible(v.colVisible);
    setViewOpts(v.viewOpts);
  }, []);

  const deleteView = useCallback((id: string) => {
    setSavedViews((list) => list.filter((x) => x.id !== id));
  }, []);

  const setGanttCol = useCallback((id: GanttListColumnId, visible: boolean) => {
    setGanttListCols((prev) => ({ ...prev, [id]: visible }));
  }, []);

  return {
    colWidths,
    setColWidths,
    colVisible,
    setColVisible,
    viewOpts,
    setViewOpts,
    savedViews,
    saveView,
    applyView,
    deleteView,
    onWidthChange,
    ganttListCols,
    setGanttListCols,
    setGanttCol,
  };
}
