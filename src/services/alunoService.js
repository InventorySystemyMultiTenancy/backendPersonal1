const { AppError } = require("../utils/appError");
const { isUuid } = require("../utils/validation");
const { randomUUID } = require("node:crypto");

const WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addWeeks(date, amount) {
  return addDays(date, amount * 7);
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDateTimeForWeekday({ startsOn, weekday, time }) {
  const weekdayIndex = WEEKDAYS.indexOf(weekday);
  if (weekdayIndex < 0) {
    return null;
  }

  const [hours, minutes] = String(time || "")
    .split(":")
    .map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const first = new Date(startsOn);
  const daysUntilWeekday = (weekdayIndex - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + daysUntilWeekday);
  first.setHours(hours, minutes, 0, 0);

  return first;
}

function eventsOverlap(a, b) {
  const aEnd = a.endsAt || new Date(a.startsAt.getTime() + 60 * 60 * 1000);
  const bEnd = b.endsAt || new Date(b.startsAt.getTime() + 60 * 60 * 1000);

  return a.startsAt < bEnd && b.startsAt < aEnd;
}

function isInitialProfileComplete(aluno) {
  return Boolean(
    aluno?.fullName &&
      aluno?.birthDate &&
      aluno?.gender &&
      String(aluno.fullName).trim() &&
      String(aluno.gender).trim(),
  );
}

class AlunoService {
  constructor(alunoRepository, agendaRepository) {
    this.alunoRepository = alunoRepository;
    this.agendaRepository = agendaRepository;
  }

  // Main multi-tenant example requested: scoped by authContext.personalId.
  async getAllAlunos(authContext) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    return this.alunoRepository.getAll(authContext);
  }

  async createAluno(authContext, payload) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (payload?.alunoPlanId && !isUuid(payload.alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
    }

    const alunoData = {
      fullName: payload.fullName,
      email: payload.email || null,
      phone: payload.phone || null,
      birthDate: payload.birthDate ? new Date(payload.birthDate) : null,
      planDueDate: payload.planDueDate ? new Date(payload.planDueDate) : null,
      alunoPlanId: payload.alunoPlanId || null,
      isActive: payload.isActive !== false,
    };

    const workoutPlans = Array.isArray(payload.workoutPlans)
      ? payload.workoutPlans
      : Array.isArray(payload.workouts)
        ? payload.workouts
        : [];

    if (workoutPlans.length === 0) {
      return this.alunoRepository.create(authContext, alunoData);
    }

    const preparedWorkoutPlans = this.prepareWorkoutPlans(workoutPlans);
    await this.ensureNoScheduleConflicts(preparedWorkoutPlans);

    return this.alunoRepository.createWithWorkoutSetup(
      authContext,
      alunoData,
      preparedWorkoutPlans,
    );
  }

  prepareWorkoutPlans(workoutPlans) {
    return workoutPlans.map((workout, index) => {
      if (!workout || typeof workout !== "object") {
        throw new AppError("Each workout plan must be an object", 400);
      }

      if (workout.templateId && !isUuid(workout.templateId)) {
        throw new AppError(
          "workoutPlans[].templateId must be a valid UUID",
          400,
        );
      }

      if (!workout.templateId && !workout.title) {
        throw new AppError(
          "workoutPlans[].title is required when templateId is not provided",
          400,
        );
      }

      const items = Array.isArray(workout.items) ? workout.items : [];
      for (const item of items) {
        if (
          !item?.exerciseName ||
          item.sets === undefined ||
          item.reps === undefined
        ) {
          throw new AppError(
            "workoutPlans[].items[] must include exerciseName, sets and reps",
            400,
          );
        }
      }

      return {
        templateId: workout.templateId || null,
        title: workout.title || null,
        objective: workout.objective || null,
        isActive: workout.isActive !== false,
        saveAsTemplate: workout.saveAsTemplate === true,
        items,
        events: this.prepareWorkoutEvents(workout, index),
      };
    });
  }

  prepareWorkoutEvents(workout, workoutIndex) {
    const events = [];

    if (Array.isArray(workout.sessions)) {
      for (const session of workout.sessions) {
        if (!session?.startsAt) {
          throw new AppError(
            "workoutPlans[].sessions[].startsAt is required",
            400,
          );
        }

        const startsAt = new Date(session.startsAt);
        const endsAt = session.endsAt ? new Date(session.endsAt) : null;

        if (Number.isNaN(startsAt.getTime())) {
          throw new AppError(
            "workoutPlans[].sessions[].startsAt must be a valid date",
            400,
          );
        }

        if (endsAt && Number.isNaN(endsAt.getTime())) {
          throw new AppError(
            "workoutPlans[].sessions[].endsAt must be a valid date",
            400,
          );
        }

        events.push({
          title: session.title || workout.title || null,
          description: session.description || workout.objective || null,
          startsAt,
          endsAt,
          recurrence: session.recurrence || "NONE",
          recurrenceUntil: session.recurrenceUntil
            ? new Date(session.recurrenceUntil)
            : null,
          recurrenceGroupId: session.recurrenceGroupId || null,
        });
      }
    }

    const schedule = workout.schedule;
    if (!schedule) {
      return events;
    }

    const days = Array.isArray(schedule.days) ? schedule.days : [];
    if (days.length === 0) {
      throw new AppError(
        "workoutPlans[].schedule.days must be a non-empty array",
        400,
      );
    }

    const startsOn = parseDateOnly(schedule.startsOn) || new Date();
    startsOn.setHours(0, 0, 0, 0);

    const recurrenceUntil = parseDateOnly(schedule.recurrenceUntil);
    if (!recurrenceUntil) {
      throw new AppError(
        "workoutPlans[].schedule.recurrenceUntil is required",
        400,
      );
    }
    recurrenceUntil.setHours(23, 59, 59, 999);

    if (recurrenceUntil < startsOn) {
      throw new AppError(
        "workoutPlans[].schedule.recurrenceUntil must be after startsOn",
        400,
      );
    }

    const defaultDurationMinutes = Number(schedule.durationMinutes || 60);
    if (
      !Number.isFinite(defaultDurationMinutes) ||
      defaultDurationMinutes <= 0
    ) {
      throw new AppError(
        "workoutPlans[].schedule.durationMinutes must be positive",
        400,
      );
    }

    for (const day of days) {
      const weekday = String(day?.weekday || "").toUpperCase();
      if (!WEEKDAYS.includes(weekday)) {
        throw new AppError(
          "workoutPlans[].schedule.days[].weekday is invalid",
          400,
        );
      }

      const firstStart = buildDateTimeForWeekday({
        startsOn,
        weekday,
        time: day.time,
      });

      if (!firstStart) {
        throw new AppError(
          "workoutPlans[].schedule.days[].time must be HH:mm",
          400,
        );
      }

      const durationMinutes = Number(
        day.durationMinutes || defaultDurationMinutes,
      );
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new AppError(
          "workoutPlans[].schedule.days[].durationMinutes must be positive",
          400,
        );
      }

      const groupId = randomUUID();
      const maxOccurrences = 104;

      for (let occurrence = 0; occurrence < maxOccurrences; occurrence += 1) {
        const startsAt = addWeeks(firstStart, occurrence);
        if (startsAt > recurrenceUntil) {
          break;
        }

        events.push({
          title: day.title || workout.title || null,
          description: day.description || workout.objective || null,
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMinutes * 60 * 1000),
          recurrence: "WEEKLY",
          recurrenceUntil,
          recurrenceGroupId: groupId,
          sourceWorkoutIndex: workoutIndex,
        });
      }
    }

    return events;
  }

  async ensureNoScheduleConflicts(workoutPlans) {
    const events = workoutPlans.flatMap((workout) => workout.events || []);

    for (let i = 0; i < events.length; i += 1) {
      for (let j = i + 1; j < events.length; j += 1) {
        if (eventsOverlap(events[i], events[j])) {
          throw new AppError(
            `Conflito de agenda entre treinos selecionados em ${events[i].startsAt.toISOString()}`,
            409,
          );
        }
      }
    }

    for (const event of events) {
      const conflict = await this.agendaRepository.findWorkoutConflict({
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      });

      if (conflict) {
        throw new AppError(
          `Conflito de agenda: ja existe treino para ${conflict.aluno?.fullName || "outro aluno"} em ${conflict.startsAt.toISOString()}`,
          409,
        );
      }
    }
  }

  async updateAluno(authContext, id, payload) {
    if (!authContext || !authContext.personalId) {
      throw new AppError("Tenant context is required", 403);
    }

    if (!isUuid(id)) {
      throw new AppError("id must be a valid UUID", 400);
    }

    if (payload?.alunoPlanId && !isUuid(payload.alunoPlanId)) {
      throw new AppError("alunoPlanId must be a valid UUID", 400);
    }

    const current = await this.alunoRepository.findById(id);

    if (!current) {
      throw new AppError("Aluno not found", 404);
    }

    const nextData = {
      fullName: payload.fullName ?? current.fullName,
      email: payload.email ?? current.email,
      phone: payload.phone ?? current.phone,
      gender: payload.gender ?? current.gender,
      photoUrl: payload.photoUrl ?? current.photoUrl,
      birthDate:
        payload.birthDate !== undefined
          ? payload.birthDate
            ? new Date(payload.birthDate)
            : null
          : current.birthDate,
      planDueDate:
        payload.planDueDate !== undefined
          ? payload.planDueDate
            ? new Date(payload.planDueDate)
            : null
          : current.planDueDate,
      alunoPlanId:
        payload.alunoPlanId !== undefined
          ? payload.alunoPlanId || null
          : current.alunoPlanId,
      isActive:
        payload.isActive !== undefined
          ? Boolean(payload.isActive)
          : current.isActive,
    };

    nextData.profileCompleted =
      payload.profileCompleted !== undefined
        ? Boolean(payload.profileCompleted)
        : current.profileCompleted || isInitialProfileComplete(nextData);

    return this.alunoRepository.updateById(id, nextData);
  }

  async getMyProfile(authContext) {
    if (!authContext?.userId) {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findProfileByUserId(
      authContext.userId,
    );

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return aluno;
  }

  async updateMyProfile(authContext, payload) {
    if (!authContext?.userId) {
      throw new AppError("Unauthorized", 401);
    }

    const aluno = await this.alunoRepository.findByUserId(authContext.userId);

    if (!aluno) {
      throw new AppError("Aluno not found", 404);
    }

    return this.updateAluno(authContext, aluno.id, payload);
  }
}

module.exports = { AlunoService };
