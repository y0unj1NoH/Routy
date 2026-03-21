import { z } from "zod";

import { UI_COPY } from "@/constants/ui-copy";

export const PLACE_LIST_NAME_MAX_LENGTH = 12;
export const PLACE_LIST_CITY_MAX_LENGTH = 12;

function hasValidUrlFormat(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isGoogleMapsHost(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl" || host.endsWith(".google.com");
  } catch {
    return false;
  }
}

export const placeListOptionalNameInputSchema = z
  .string()
  .trim()
  .max(PLACE_LIST_NAME_MAX_LENGTH, UI_COPY.common.form.listNameMax);

export const placeListNameInputSchema = placeListOptionalNameInputSchema.min(1, UI_COPY.common.form.listNameRequired);

export const placeListCityInputSchema = z
  .string()
  .trim()
  .min(1, UI_COPY.common.form.cityRequired)
  .max(PLACE_LIST_CITY_MAX_LENGTH, UI_COPY.common.form.cityMax);

export const googleMapsUrlInputSchema = z
  .string()
  .trim()
  .min(1, UI_COPY.common.form.googleMapsUrlRequired)
  .refine(hasValidUrlFormat, UI_COPY.common.form.validUrl)
  .refine(isGoogleMapsHost, UI_COPY.common.form.googleMapsUrlRequired);

export const crawlerImportFormSchema = z.object({
  crawlerUrl: googleMapsUrlInputSchema,
  listName: placeListOptionalNameInputSchema,
  city: placeListCityInputSchema
});

export const googleMapsImportFormSchema = z.object({
  googleUrl: googleMapsUrlInputSchema
});
