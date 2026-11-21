"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

export function DeclarationForm({
  fullName,
  dni,
  address,
}: {
  fullName: string;
  dni: string;
  address: string;
}) {
  const [patientName, setPatientName] = useState(fullName);
  const [patientDni, setPatientDni] = useState(dni);
  const [patientAddress, setPatientAddress] = useState(address);
  const [doctor, setDoctor] = useState("");
  const [license, setLicense] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");

  return (
    <div className="space-y-5">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Revisá los campos y luego imprimí la declaración para firmarla.</p>
        <button type="button" onClick={() => window.print()} className="btn-primary btn-sm">
          <Printer className="size-3.5" />
          Imprimir
        </button>
      </div>

      <article className="print-document mx-auto max-w-3xl border border-ink/15 bg-white p-8 text-[13px] leading-7 text-black shadow-card sm:p-12">
        <h1 className="mb-8 text-center text-lg font-bold tracking-wide">
          DECLARACIÓN JURADA DE VINCULACIÓN
        </h1>

        <p>
          Paciente Sra/Sr.{" "}
          <input
            aria-label="Nombre del paciente"
            className="print-underline w-56"
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
          />
          , DNI{" "}
          <input
            aria-label="DNI del paciente"
            className="print-underline w-32"
            value={patientDni}
            onChange={(event) => setPatientDni(event.target.value)}
          />
          , con domicilio real en{" "}
          <input
            aria-label="Domicilio real"
            className="print-underline w-64"
            value={patientAddress}
            onChange={(event) => setPatientAddress(event.target.value)}
          />
          , declaro bajo juramento que:
        </p>

        <p className="mt-5">
          Primero: Que soy paciente del Dr.{" "}
          <input
            aria-label="Nombre del profesional"
            className="print-underline w-56"
            value={doctor}
            onChange={(event) => setDoctor(event.target.value)}
          />
          , Matrícula Nacional{" "}
          <input
            aria-label="Matrícula nacional"
            className="print-underline w-32"
            value={license}
            onChange={(event) => setLicense(event.target.value)}
          />
          , quien me ha prescripto el uso de cannabis medicinal para el
          tratamiento de mi condición de salud, motivo por el cual se encuentra
          iniciada la solicitud de inscripción ante REPROCANN a favor de mi
          persona.
        </p>

        <p className="mt-5">
          Segundo: Que, en virtud de la mencionada indicación médica, he
          decidido recurrir a la Asociación Civil PANGO CUIT: 30-71798481-8
          especializada en la provisión de Cannabis medicinal, para acceder al
          tratamiento que me corresponde.
        </p>

        <p className="mt-5">
          Tercero: Que manifiesto mi consentimiento expreso para que esta
          declaración jurada y antecedentes médicos sean presentados en el
          marco de un expediente administrativo y/o el fin de solicitar la
          habilitación para que la mencionada ONG pueda proveerme mi medicina
          conforme a la prescripción médica recibida, y para que se garantice
          mi derecho al acceso a tratamientos médicos adecuados.
        </p>

        <p className="mt-5">
          Cuarto: Que renuncio expresamente al autocultivo o a vincularme con
          otra persona jurídica o tercero cultivador.
        </p>

        <p className="mt-5">
          En virtud de lo expuesto, firmo la presente declaración jurada en
          PARANA, ENTRE RIOS, a los{" "}
          <input
            aria-label="Día"
            className="print-underline w-12"
            inputMode="numeric"
            maxLength={2}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />{" "}
          días del mes de{" "}
          <input
            aria-label="Mes"
            className="print-underline w-28"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />{" "}
          del año 2026.
        </p>

        <div className="mt-20 flex justify-end">
          <div className="w-64 border-t border-black pt-2 text-center">
            Firma y Aclaración EL/LA PACIENTE
          </div>
        </div>
      </article>
    </div>
  );
}
