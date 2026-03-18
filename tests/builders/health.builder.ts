/**
 * Health Domain Test Data Builder
 */

import { v4 as uuid } from 'uuid';

//  Patient 

export interface PatientPayload {
  name: string;
  dob: string;
  mrn: string;
  ownerId: string;
}

export class PatientBuilder {
  private payload: PatientPayload = {
    name: 'Jane Doe',
    dob: '1985-06-15',
    mrn: `MRN-${uuid().slice(0, 8).toUpperCase()}`,
    ownerId: `user-${uuid()}`,
  };

  withName(name: string): this {
    this.payload.name = name;
    return this;
  }

  withDob(dob: string): this {
    this.payload.dob = dob;
    return this;
  }

  withOwner(ownerId: string): this {
    this.payload.ownerId = ownerId;
    return this;
  }

  build(): PatientPayload {
    return { ...this.payload };
  }
}

//  Appointment 

export interface AppointmentPayload {
  patientId: string;
  providerId: string;
  startTime: string;
  endTime: string;
  type: string;
}

export class AppointmentBuilder {
  private payload: AppointmentPayload;

  constructor() {
    const base = new Date('2026-06-01T10:00:00Z');
    this.payload = {
      patientId: uuid(),
      providerId: uuid(),
      startTime: base.toISOString(),
      endTime: new Date(base.getTime() + 30 * 60 * 1000).toISOString(),
      type: 'checkup',
    };
  }

  forPatient(patientId: string): this {
    this.payload.patientId = patientId;
    return this;
  }

  withProvider(providerId: string): this {
    this.payload.providerId = providerId;
    return this;
  }

  at(startIso: string, durationMinutes = 30): this {
    const start = new Date(startIso);
    this.payload.startTime = start.toISOString();
    this.payload.endTime = new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString();
    return this;
  }

  /** Overlapping appointment — triggers APPOINTMENT_DOUBLE_BOOKING race condition test. */
  overlappingWith(other: AppointmentPayload): this {
    // Start 10 min into the other appointment's window
    const start = new Date(other.startTime).getTime() + 10 * 60 * 1000;
    this.payload.patientId = other.patientId;
    this.payload.providerId = other.providerId;
    this.payload.startTime = new Date(start).toISOString();
    this.payload.endTime = new Date(start + 20 * 60 * 1000).toISOString();
    return this;
  }

  build(): AppointmentPayload {
    return { ...this.payload };
  }
}

//  Medication 

export interface MedicationPayload {
  patientId: string;
  name: string;
  dosage: string | number;
  unit: string;
  frequency: string;
}

export class MedicationBuilder {
  private payload: MedicationPayload = {
    patientId: uuid(),
    name: 'Metformin',
    dosage: 500,
    unit: 'mg',
    frequency: 'twice daily',
  };

  forPatient(patientId: string): this {
    this.payload.patientId = patientId;
    return this;
  }

  withDosage(dosage: string | number): this {
    this.payload.dosage = dosage;
    return this;
  }

  /** String dosage — exposes DOSAGE_TYPE_MISMATCH (TEXT vs numeric). */
  withStringDosage(dosage: string): this {
    this.payload.dosage = dosage;
    return this;
  }

  build(): MedicationPayload {
    return { ...this.payload };
  }
}
