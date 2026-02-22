import { AbilityBuilder, AbilityClass, PureAbility } from "@casl/ability";

export type AppAction = "manage" | "create" | "read" | "update" | "delete";
export type AppSubject = string;

export type AppAbility = PureAbility<[AppAction, AppSubject]>;

const actionMap: Record<string, AppAction> = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  ADMIN: "manage",
};

export function buildAbilityFromPermissions(permissions: string[]) {
  const { can, build } = new AbilityBuilder<AppAbility>(PureAbility as AbilityClass<AppAbility>);

  for (const entry of permissions) {
    const [moduleSlug, actionRaw] = entry.split(":");
    const action = actionMap[actionRaw] ?? "read";
    if (moduleSlug) {
      can(action, moduleSlug);
    }
  }

  return build();
}
