import type { FormElement, FormProperties } from "@gcforms/types";

/** Mirrors the Forms client sortByLayout / getLayoutFromGroups ordering. */
export function orderFormElements(form: FormProperties): FormElement[] {
  let layout = form.layout ?? [];
  if (form.groups) {
    const groupLayout: number[] = [];
    for (const groupKey of Object.keys(form.groups)) {
      const group = form.groups[groupKey];
      for (const elementId of group?.elements ?? []) groupLayout.push(Number(elementId));
    }
    layout = groupLayout;
  }

  const orderIndex = new Map<number, number>();
  layout.forEach((id, index) => {
    if (!orderIndex.has(id)) orderIndex.set(id, index);
  });
  return [...(form.elements ?? [])].sort(
    (a, b) => (orderIndex.get(a.id) ?? -1) - (orderIndex.get(b.id) ?? -1),
  );
}
