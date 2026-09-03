import { render, screen } from "@testing-library/react"
import { AttendanceList } from "@/components/attendances/attendance-list"
import { AttendanceSummaryStrip } from "@/components/attendances/attendance-summary-strip"
import type { AttendanceQueueRow } from "@/lib/attendances/attendance-types"

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

jest.mock("@/components/contacts/site-contact-quick-actions", () => ({
  SiteContactQuickActions: () => <div>Ações WhatsApp mock</div>,
}))

const row: AttendanceQueueRow = {
  id: "contact-1",
  name: "Maria Compradora",
  email: null,
  phone: "11999999999",
  status: "new",
  type: "lead",
  deal_stage: "lead",
  assigned_to: "broker-1",
  organization_id: "org-1",
  city: null,
  created_at: "2026-05-11T18:00:00.000Z",
  siteMeta: {
    source: "site",
    domain: "www.vivacrm.com.br",
    lastEventAt: "2026-05-11T18:00:00.000Z",
  },
  latestLeadAt: "2026-05-11T18:00:00.000Z",
  latestInteractionAt: null,
  latestInteractionSummary: null,
  nextAppointmentAt: null,
  nextAppointmentId: null,
  assignedProfileName: "Broker Demo",
  leadPropertyContext: {
    id: "property-1",
    title: "[V-598] casa condomínio paraíso",
  },
  nextAction: {
    key: "first_contact",
    label: "Fazer primeiro contato",
    priority: "high",
    hrefKind: "whatsapp",
  },
}

describe("Attendance operational UI", () => {
  it("renders the queue row with daily context, next action, owner, property and CTAs", () => {
    render(<AttendanceList rows={[row]} />)

    expect(screen.getByText("Maria Compradora")).toBeInTheDocument()
    expect(screen.getByText("Fazer primeiro contato")).toBeInTheDocument()
    expect(screen.getByText("Responsável: Broker Demo")).toBeInTheDocument()
    expect(screen.getByText("Imóvel: [V-598] casa condomínio paraíso")).toBeInTheDocument()
    expect(screen.getByText("Site")).toBeInTheDocument()
    expect(screen.getByText("Situação: Novo")).toBeInTheDocument()
    expect(screen.getByText("Estágio: Lead")).toBeInTheDocument()
    expect(screen.getByText("Ações WhatsApp mock")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Abrir ficha/i })).toHaveAttribute("href", "/contacts/contact-1")
  })

  it("renders summary metrics", () => {
    render(
      <AttendanceSummaryStrip
        metrics={{
          total: 4,
          newWithoutContact: 2,
          inProgress: 1,
          overdue: 1,
          upcomingVisits: 1,
        }}
      />
    )

    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("Atendimentos no recorte")).toBeInTheDocument()
    expect(screen.getByText("SLA atrasado")).toBeInTheDocument()
  })
})
