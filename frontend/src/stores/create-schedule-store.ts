"use client";

import { create } from "zustand";

import type { CreateScheduleFormValues } from "@/types/domain";

type CreateScheduleStore = {
  values: CreateScheduleFormValues;
  setValues: (values: Partial<CreateScheduleFormValues>) => void;
  resetValues: () => void;
};

const initialValues: CreateScheduleFormValues = {
  title: "",
  startDate: "",
  endDate: "",
  placeListId: "",
  stayMode: null,
  stayPlaceId: null,
  companions: null,
  pace: null,
  themes: []
};

export const useCreateScheduleStore = create<CreateScheduleStore>((set) => ({
  values: initialValues,
  setValues: (values) =>
    set((state) => ({
      values: {
        ...state.values,
        ...values
      }
    })),
  resetValues: () => set({ values: initialValues })
}));
