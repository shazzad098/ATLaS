import { requireActiveStore } from "@/lib/tenant";
import { loadEntitlementSnapshot } from "@/lib/entitlements";
import { SYSTEM_ROLES, type RoleCode } from "@/lib/rbac";
import { listStaff } from "@/lib/services/staff-service";
import { formatDate } from "@/lib/dates";
import { Badge, Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/shell";
import { StaffInviteForm, StaffRowActions } from "@/app/admin/_components/staff-forms";

/** Staff and roles (FR-02, PRD §4.4). */

export const metadata = { title: "স্টাফ" };

export default async function StaffPage() {
  const { workspace } = await requireActiveStore();
  const [staff, snapshot] = await Promise.all([
    listStaff(workspace.activeTenant.tenantId),
    loadEntitlementSnapshot(workspace.activeTenant.tenantId),
  ]);

  const seatsUsed = staff.length;
  const seatLimit = snapshot.limits.staffSeats;
  const seatsLeft = Math.max(0, seatLimit - seatsUsed);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">স্টাফ ও রোল</h1>
        <p className="text-sm text-ink-500">
          সিট ব্যবহার {seatsUsed} / {seatLimit} · {snapshot.planName} প্ল্যান
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title="টিমে যোগ করুন"
            description={seatsLeft > 0 ? `${seatsLeft}টি সিট খালি` : "সিট সীমা শেষ — প্ল্যান upgrad করুন"}
          />
          <CardBody>
            <StaffInviteForm
              seatHint={seatsLeft > 0 ? `${seatsLeft}টি সিট খালি আছে` : "সিট সীমা শেষ"}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
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
                        membershipId={member.id}
                        roleCode={member.role.code}
                        isOwner={member.role.code === "OWNER"}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="রোল ও অনুমতি" description="সিস্টেম রোল (PRD §4.4)" />
            <CardBody className="space-y-3">
              {(Object.keys(SYSTEM_ROLES) as RoleCode[]).map((code) => (
                <div key={code} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{SYSTEM_ROLES[code].name}</p>
                    <Badge tone="neutral">{SYSTEM_ROLES[code].permissions.length} অনুমতি</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{SYSTEM_ROLES[code].description}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
