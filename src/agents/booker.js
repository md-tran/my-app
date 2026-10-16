import { addBusinessDays } from './sequencer';

// Booking agent: offers open slots from the rep's availability and books
// the meeting as soon as a prospect replies positively.

export function proposeSlots(availability, bookedMeetings = [], from = new Date(), count = 3) {
  const taken = new Set(bookedMeetings.map((m) => m.start));
  const slots = [];
  for (let offset = 1; slots.length < count && offset <= 20; offset++) {
    const day = addBusinessDays(from, offset);
    for (const hour of availability.hours) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const iso = start.toISOString();
      if (!taken.has(iso)) {
        slots.push(iso);
        taken.add(iso);
        break; // one slot per day gives the prospect a real choice of days
      }
    }
  }
  return slots;
}

export function bookMeeting(prospect, slot, availability) {
  const start = new Date(slot);
  const end = new Date(start.getTime() + availability.durationMinutes * 60000);
  return {
    id: `m_${prospect.id}_${start.getTime()}`,
    prospectId: prospect.id,
    title: `${availability.meetingTitle} — ${prospect.company.name}`,
    attendee: `${prospect.firstName} ${prospect.lastName}`,
    attendeeEmail: prospect.email,
    start: start.toISOString(),
    end: end.toISOString(),
    link: availability.meetingLink,
    status: 'confirmed',
  };
}
