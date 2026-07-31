import type { ServiceId } from "@crm/contracts";

const SERVICE_ID: ServiceId = "crm-web";

export default function Home() {
  return (
    <main
      data-service={SERVICE_ID}
      className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50"
    >
      <div className="text-center">
        <h1 className="text-3xl font-semibold">
          CRM Gestão Comercial e Contabilidade
        </h1>

        <p className="mt-3 text-zinc-400">
          Web application is running.
        </p>
      </div>
    </main>
  );
}