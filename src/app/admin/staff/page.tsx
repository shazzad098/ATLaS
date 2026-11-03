import { requirePermissionPage } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  SYSTEM_ROLES,
  parsePermissions,
  type Permission,
  type RoleCode,
} from "@/lib/rbac";
import { listRoles, listStaff } from "@/lib/services/staff-service";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import {
  RoleCreateForm,
  RoleEditForm,
  StaffInviteForm,
  StaffRowActions,
  type PermissionGroupOption,
  type RoleOption,
} from "@/app/admin/_components/staff-forms";

/** Staff, roles and permission matrix (FR-02, PRD §4.4). */

export const metadata = { title: "স্টাফ ও রোল" };

export default async function StaffPage() {
  const workspace = await requirePermissionPage("staff:read");
  const tenantId = workspace.activeTenant.tenantId;
  const [staff, roles, snapshot] = await Promise.all([
    listStaff(tenantId),
    listRoles(tenantId),
    loadEntitlementSnapshot(tenantId),
  ]);

  const canWrite = workspace.actor.permissions.includes("staff:write");
  const isOwner = workspace.actor.roleCode === "OWNER";
  const seatsUsed = staff.length;
  const seatLimit = snapshot.limits.staffSeats;
  const seatsLeft = Math.max(0, seatLimit - seatsUsed);

  const roleOptions: RoleOption[] = roles
    .filter((role) => role.code !== "OWNER")
    .map((role) => ({ code: role.code, name: role.name, isSystem: role.isSystem }));

  const groups: PermissionGroupOption[] = PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    description: group.description,
    permissions: group.permissions.map((permission) => ({
      value: permission,
      label: PERMISSION_LABELS[permission],
    })),
  }));

  const systemRoles = roles.filter((role) => role.isSystem);
  const customRoles = roles.filter((role) => !role.isSystem);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">স্টাফ ও রোল</h1>
          <p className="text-sm text-ink-500">
            সিট ব্যবহার {seatsUsed} / {seatLimit} · {snapshot.planName} প্ল্যান · আপনার role{" "}
            {workspace.activeTenant.roleName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={seatsLeft > 0 ? "success" : "warning"}>
            {seatsLeft > 0 ? `${seatsLeft}টি সিট খালি` : "সিট সীমা শেষ"}
          </Badge>
          <Badge tone="neutral">{roles.length}টি রোল</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title="টিমে যোগ করুন"
            description={
              canWrite
                ? seatsLeft > 0
                  ? `${seatsLeft}টি সিট খালি`
                  : "সিট সীমা শেষ — প্ল্যান upgrad করুন"
                : "আপনার role-এ সদস্য যোগ করার অনুমতি নেই"
            }
          />
          <CardBody>
            {canWrite ? (
              <StaffInviteForm
                roles={roleOptions}
                seatHint={seatsLeft > 0 ? `${seatsLeft}টি সিট খালি আছে` : "সিট সীমা শেষ"}
              />
            ) : (
              <p className="text-sm text-ink-500">
                Owner বা Admin-কে অনুরোধ করুন নতুন সদস্য যোগ করার জন্য।
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="টিম সদস্য" description={`${staff.length} জন`} />
          <Table>
            <thead>
              <tr>
                <Th>সদস্য</Th>
                <Th>যোগদান</Th>
                <Th>Role / কাজ</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id}>
                  <Td>
                    <span className="font-medium text-ink-900">{member.user.name ?? "—"}</span>
                    <span className="block text-xs text-ink-500">{member.user.phone}</span>
                  </Td>
                  <Td className="text-xs text-ink-500">{formatDate(member.createdAt)}</Td>
                  <Td>
                    <StaffRowActions
                      roles={roleOptions}
                      membershipId={member.id}
                      roleCode={member.role.code}
                      roleName={member.role.name}
                      isOwner={member.role.code === "OWNER"}
                      canWrite={canWrite}
                      isSelf={member.user.id === workspace.user.id}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="রোল ও অনুমতি"
          description={
            isOwner
              ? "সিস্টেম রোল ফিক্সড; আপনার টিমের জন্য কাস্টম রোল তৈরি করে নির্দিষ্ট অনুমতি দিন।"
              : "সিস্টেম রোল ফিক্সড। কাস্টম রোল তৈরি বা সম্পাদনা শুধু Owner করতে পারেন।"
          }
          action={isOwner ? <RoleCreateForm groups={groups} /> : null}
        />

        <CardBody className="space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
              সিস্টেম রোল
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {systemRoles.map((role) => {
                const permissions = parsePermissions(role.permissionsJson);
                const system = SYSTEM_ROLES[role.code as RoleCode];
                const covered = PERMISSION_GROUPS.filter((group) =>
                  group.permissions.some((permission) => permissions.includes(permission)),
                ).map((group) => group.label);
                return (
                  <div key={role.id} className="rounded-xl border border-ink-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink-900">
                        {system?.name ?? role.name}
                      </p>
                      <Badge tone="neutral">{permissions.length} অনুমতি</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">
                      {system?.description ?? "সিস্টেম রোল"}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                      {covered.join(" · ") || "কোনো অনুমতি নেই"}
                    </p>
                    <p className="mt-2 text-[11px] text-ink-400">
                      {role._count.memberships} জন সদস্য
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-500 uppercase">
                কাস্টম রোল
              </p>
              <span className="text-[11px] text-ink-500">{customRoles.length}টি</span>
            </div>

            {customRoles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-xs text-ink-500">
                এখনো কোনো কাস্টম রোল নেই। Owner চাইলে উপরের “নতুন কাস্টম রোল” দিয়ে একটি তৈরি করতে
                পারেন।
              </p>
            ) : (
              <div className="space-y-3">
                {customRoles.map((role) => {
                  const permissions = parsePermissions(role.permissionsJson);
                  const labels = permissions.map(
                    (permission: Permission) => PERMISSION_LABELS[permission],
                  );
                  return (
                    <div key={role.id} className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {labels.slice(0, 8).map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] text-ink-600"
                          >
                            {label}
                          </span>
                        ))}
                        {labels.length > 8 ? (
                          <span className="text-[10px] text-ink-500">
                            +{labels.length - 8} আরও
                          </span>
                        ) : null}
                      </div>
                      {isOwner ? (
                        <RoleEditForm
                          roleId={role.id}
                          name={role.name}
                          groups={groups}
                          selected={permissions}
                          memberCount={role._count.memberships}
                        />
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-ink-900">{role.name}</p>
                            <p className="text-[11px] text-ink-500">
                              {permissions.length}টি অনুমতি · {role._count.memberships} জন সদস্য
                            </p>
                          </div>
                          <Badge tone="neutral">কাস্টম</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
            নিরাপত্তা: কাস্টম রোল শুধু Owner তৈরি/সম্পাদনা করতে পারেন। কোনো সদস্যকে নিজের role-এর
            বাইরের অনুমতি দেওয়া যায় না, তাই Admin বা Manager কেউ Owner-এর সমান ক্ষমতা নিজে নিতে
            বা অন্যকে দিতে পারে না।
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
