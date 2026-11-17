import { describe, expect, it } from "vitest";
import { hasPermission, isAdminRole, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { filterSidebarGroups, getSidebarGroups } from "@/lib/nav-config";

describe("RBAC", () => {
  it("super admin has every permission", () => {
    for (const p of Object.keys(PERMISSIONS)) expect(hasPermission("SUPER_ADMIN", p as keyof typeof PERMISSIONS)).toBe(true);
  });
  it("only super admin manages the institution", () => {
    expect(hasPermission("ADMIN", "institution.manage")).toBe(false);
    expect(hasPermission("TEACHER", "institution.manage")).toBe(false);
  });
  it("students and teachers cannot manage people, cards or devices", () => {
    for (const role of ["STUDENT", "TEACHER"] as const) {
      for (const p of ["students.manage", "teachers.manage", "smartid.manage", "devices.manage", "academic.manage"] as const) {
        expect(hasPermission(role, p)).toBe(false);
      }
    }
  });
  it("teachers may teach, students may not", () => {
    expect(hasPermission("TEACHER", "classroom.teach")).toBe(true);
    expect(hasPermission("STUDENT", "classroom.teach")).toBe(false);
  });
  it("identifies admin roles", () => {
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("STUDENT")).toBe(false);
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(5);
  });
});

describe("navigation filtering", () => {
  it("hides admin items a limited role lacks", () => {
    const groups = filterSidebarGroups(getSidebarGroups("ADMIN"), (m) => !m || ["students.manage"].includes(m));
    const titles = groups.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toContain("Overview");
    expect(titles).not.toContain("Smart ID Cards");
    expect(titles).not.toContain("Academic Management");
  });
  it("returns nothing for unknown roles", () => {
    expect(getSidebarGroups("GUARDIAN")).toEqual([]);
  });
});
