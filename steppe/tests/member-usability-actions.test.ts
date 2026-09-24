import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  profile: vi.fn(),
  user: vi.fn(),
  from: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getMyProfile: m.profile,
  getCurrentUser: m.user,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: m.from }),
}));
vi.mock("next/cache", () => ({ revalidatePath: m.invalidate }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import {
  createEvent,
  updateEvent,
  deleteEvent,
  setRsvp,
  cancelRsvp,
} from "@/app/protected/events/actions";
import {
  updatePost,
  deletePost,
  createPost,
} from "@/app/protected/exchange/actions";
function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values))
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  return fd;
}
let chain: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  m.profile.mockResolvedValue({ id: "member", verified: true });
  m.user.mockResolvedValue({ id: "member" });
  chain = {};
  for (const key of ["insert", "update", "delete", "upsert", "eq", "select"])
    chain[key] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({
    data: {
      starts_at: "2026-07-16T01:00:00Z",
      ends_at: "2026-07-16T02:00:00Z",
    },
    error: null,
  }));
  chain.single = vi.fn(async () => ({ data: { id: "record" }, error: null }));
  chain.then = vi.fn((resolve) =>
    resolve({ data: { id: "record" }, error: null }),
  );
  m.from.mockReturnValue(chain);
});
describe("member writes", () => {
  it("creates at Pacific time and never auto-RSVPs", async () => {
    await expect(
      createEvent(
        null,
        form({
          title: "Gathering",
          starts_at: "2026-07-15T18:00",
          ends_at: "2026-07-15T19:00",
          location: "Sample Park, 12 Main Street",
        }),
      ),
    ).rejects.toThrow("redirect:/protected/events/record");
    expect(m.from.mock.calls).toEqual([["events"]]);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: "member",
        starts_at: "2026-07-16T01:00:00.000Z",
        ends_at: "2026-07-16T02:00:00.000Z",
        location: "Sample Park, 12 Main Street",
      }),
    );
  });
  it("rejects over-limit, nonexistent times, and reversed event ranges before writing", async () => {
    for (const overrides of [
      { title: "x".repeat(141) },
      { body: "x".repeat(2001) },
      { location: "x".repeat(301) },
      { starts_at: "2026-03-08T02:30" },
      { ends_at: "2026-07-15T17:00" },
    ]) {
      expect(
        await createEvent(
          null,
          form({
            title: "Gathering",
            starts_at: "2026-07-15T18:00",
            ...overrides,
          }),
        ),
      ).toHaveProperty("error");
    }
    expect(m.from).not.toHaveBeenCalled();
  });
  it("requires an explicit RSVP choice and bounds bringing", async () => {
    expect(await setRsvp(null, form({ event_id: "event" }))).toHaveProperty(
      "error",
    );
    expect(
      await setRsvp(
        null,
        form({ event_id: "event", status: "going", bringing: "x".repeat(121) }),
      ),
    ).toHaveProperty("error");
    expect(m.from).not.toHaveBeenCalled();
  });
  it("cancels only the caller's RSVP and refreshes all personal badges", async () => {
    expect(
      await cancelRsvp(
        null,
        form({ event_id: "event", user_id: "someone-else" }),
      ),
    ).toEqual({ ok: true });
    expect(chain.eq.mock.calls).toEqual([
      ["event_id", "event"],
      ["user_id", "member"],
    ]);
    expect(m.invalidate).toHaveBeenCalledWith("/protected/account/calendar");
    expect(m.invalidate).toHaveBeenCalledWith("/protected/exchange");
  });
  it("writes multiple tags and bounds posts", async () => {
    await expect(
      createPost(
        null,
        form({
          title: "Tools",
          body: "Lend these",
          category: ["offer", "goods"],
        }),
      ),
    ).rejects.toThrow("redirect:/protected/exchange?posted=1");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        author_id: "member",
        tags: ["offer", "goods"],
        category: "offer",
      }),
    );
  });
  it("author-scopes edits and never claims success on a missing or denied row", async () => {
    chain.single.mockResolvedValue({ data: null, error: null });
    expect(
      await updatePost(
        "post",
        null,
        form({
          title: "New title",
          body: "Content",
          category: ["offer", "goods"],
          author_id: "another",
        }),
      ),
    ).toHaveProperty("error");
    expect(chain.eq.mock.calls).toEqual([
      ["id", "post"],
      ["author_id", "member"],
    ]);
    expect(m.invalidate).not.toHaveBeenCalled();
  });
  it("requires deliberate deletion and scopes it to the author", async () => {
    expect(await deletePost("post", null, new FormData())).toHaveProperty(
      "error",
    );
    expect(m.from).not.toHaveBeenCalled();
    await expect(
      deletePost("post", null, form({ confirm: "delete" })),
    ).rejects.toThrow("redirect:/protected/exchange?deleted=1");
    expect(chain.eq.mock.calls).toEqual([
      ["id", "post"],
      ["author_id", "member"],
    ]);
  });
  it("blocks unverified creation and edits", async () => {
    m.profile.mockResolvedValue({ id: "member", verified: false });
    expect(
      await createEvent(
        null,
        form({ title: "event", starts_at: "2026-07-15T18:00" }),
      ),
    ).toHaveProperty("error");
    expect(
      await updatePost(
        "post",
        null,
        form({ title: "Post", body: "Content", category: "offer" }),
      ),
    ).toHaveProperty("error");
    expect(m.from).not.toHaveBeenCalled();
  });
});

describe("event owner management", () => {
  const draft = () =>
    form({
      title: "Updated gathering",
      starts_at: "2026-07-16T18:00",
      ends_at: "2026-07-16T19:00",
      location: "Another park",
      creator_id: "someone-else",
      group_id: "another-board",
      status: "cancelled",
    });
  it("updates only editable fields on the caller's event and refreshes calendar projections", async () => {
    await expect(updateEvent("event", null, draft())).rejects.toThrow(
      "redirect:/protected/events/event?saved=1",
    );
    expect(chain.eq.mock.calls).toEqual([
      ["id", "event"],
      ["creator_id", "member"],
      ["id", "event"],
      ["creator_id", "member"],
    ]);
    expect(chain.update).toHaveBeenCalledWith({
      title: "Updated gathering",
      body: null,
      starts_at: "2026-07-17T01:00:00.000Z",
      ends_at: "2026-07-17T02:00:00.000Z",
      location: "Another park",
      capacity: null,
      neighborhood_id: null,
    });
    expect(m.from.mock.calls).toEqual([["events"], ["events"]]);
    expect(chain.delete).not.toHaveBeenCalled();
    expect(m.invalidate).toHaveBeenCalledWith("/protected/exchange/upcoming");
    expect(m.invalidate).toHaveBeenCalledWith("/protected/account/calendar");
    expect(m.invalidate).toHaveBeenCalledWith("/protected/groups", "layout");
  });
  it("refuses another owner's or missing event even for a moderator", async () => {
    m.profile.mockResolvedValue({
      id: "member",
      verified: true,
      role: "moderator",
    });
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await updateEvent("not-mine", null, draft())).toEqual({
      error: "update-failed",
    });
    expect(chain.update).not.toHaveBeenCalled();
    expect(m.invalidate).not.toHaveBeenCalled();
  });
  it("does not claim success on a refused or concurrently deleted update", async () => {
    chain.single.mockResolvedValue({ data: null, error: null });
    expect(await updateEvent("event", null, draft())).toEqual({
      error: "update-failed",
    });
    expect(m.invalidate).not.toHaveBeenCalled();
  });
  it("keeps exact stored instants when only other details change during the repeated DST hour", async () => {
    chain.maybeSingle.mockResolvedValue({
      data: {
        starts_at: "2026-11-01T09:30:25Z",
        ends_at: "2026-11-01T09:45:25Z",
      },
      error: null,
    });
    await expect(
      updateEvent(
        "event",
        null,
        form({
          title: "Same time",
          starts_at: "2026-11-01T01:30",
          ends_at: "2026-11-01T01:45",
        }),
      ),
    ).rejects.toThrow("redirect:");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at: "2026-11-01T09:30:25.000Z",
        ends_at: "2026-11-01T09:45:25.000Z",
      }),
    );
  });
  it.each([
    { title: "x".repeat(141) },
    { starts_at: "2026-03-08T02:30" },
    { ends_at: "2026-07-15T17:00" },
    { capacity: "0" },
  ])("rejects invalid edits before writing: %j", async (overrides) => {
    expect(
      await updateEvent(
        "event",
        null,
        form({ title: "Event", starts_at: "2026-07-15T18:00", ...overrides }),
      ),
    ).toHaveProperty("error");
    expect(chain.update).not.toHaveBeenCalled();
  });
  it("requires confirmation and pins deletion to the signed-in creator", async () => {
    expect(await deleteEvent("event", null, new FormData())).toHaveProperty(
      "error",
    );
    expect(m.from).not.toHaveBeenCalled();
    await expect(
      deleteEvent(
        "event",
        null,
        form({ confirm: "delete", creator_id: "other" }),
      ),
    ).rejects.toThrow("redirect:/protected/exchange?eventDeleted=1");
    expect(chain.eq.mock.calls).toEqual([
      ["id", "event"],
      ["creator_id", "member"],
    ]);
    expect(m.from.mock.calls).toEqual([["events"]]);
    expect(m.invalidate).toHaveBeenCalledWith("/protected/account/calendar");
  });
  it("does not report deletion when the row is denied or missing", async () => {
    chain.single.mockResolvedValue({
      data: null,
      error: { message: "denied" },
    });
    expect(
      await deleteEvent("event", null, form({ confirm: "delete" })),
    ).toEqual({ error: "delete-failed" });
    expect(m.invalidate).not.toHaveBeenCalled();
  });
  it("blocks unverified edits and deletions", async () => {
    m.profile.mockResolvedValue({ id: "member", verified: false });
    expect(await updateEvent("event", null, draft())).toHaveProperty("error");
    expect(
      await deleteEvent("event", null, form({ confirm: "delete" })),
    ).toHaveProperty("error");
    expect(m.from).not.toHaveBeenCalled();
  });
});
