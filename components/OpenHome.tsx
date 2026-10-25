"use client";

import { BRAND_NAME } from "@/lib/brand";
import { Page, Section, Stat, Stats } from "./Panel";
import {
  IconBeacon,
  IconCalendar,
  IconCheck,
  IconGlobe,
  IconLock,
  IconPeople,
  IconPin,
  IconSparkle,
  IconUser,
} from "./Icons";

/**
 * The open network's front page.
 *
 * It had none, on the reasoning that the open network isn't a group: there
 * is nobody running it, no rules anyone published and nothing to invite
 * people to. That was right about ownership and wrong about need — the
 * open map is where everybody lands, and it was the one surface that
 * never explained itself. A newcomer arrived at a map of strangers with a
 * dock of eight panels and no answer to "what is this and what do I do".
 *
 * Which makes this an onboarding surface before it is a reference one, and
 * it is built in that order:
 *
 *   1. what is still stopping *you* from working — named, with the button
 *      that fixes it. Nothing else on the page matters while somebody is
 *      invisible and unmatchable, and four of the first nine members were
 *      exactly that.
 *   2. how the thing works, in the three beats that are actually load
 *      bearing: who is on the map, why a recommendation can be trusted,
 *      and how somebody reaches you.
 *   3. where it is worth opening — the cases, because "a map of people"
 *      is not a use.
 *   4. the ground rules, which here are statements about how the product
 *      behaves rather than promises about moderation nobody is doing.
 *
 * The checklist disappears when it is done. A page that keeps congratulating
 * you is a page you stop reading.
 */
export default function OpenHome({
  signedIn,
  hasSignals,
  visibility,
  peopleCount,
  hereNowCount,
  eventCount,
  communityCount,
  onProfile,
  onSignIn,
  onOpenPeople,
  onOpenEvents,
  onOpenForYou,
  onOpenPins,
}: {
  signedIn: boolean;
  /** They've said what they need, offer or are into. */
  hasSignals: boolean;
  visibility: "off" | "base" | "exact" | "live";
  peopleCount: number;
  hereNowCount: number;
  eventCount: number;
  /** How many communities they're in — changes what "next" means. */
  communityCount: number;
  onProfile: () => void;
  onSignIn: () => void;
  onOpenPeople: () => void;
  onOpenEvents: () => void;
  onOpenForYou: () => void;
  onOpenPins: () => void;
}) {
  /**
   * Only what is actually undone, in the order it unblocks things.
   *
   * Signals first: without them there is nothing to match on, so being on
   * the map puts a pin somewhere that no recommendation can ever use.
   */
  const todo: Array<{ title: string; body: string; action: string; onClick: () => void }> = [];
  if (!signedIn) {
    todo.push({
      title: "Sign in",
      body: "The map is public. Who's worth meeting on it isn't — that needs to know what you're after.",
      action: "Sign in",
      onClick: onSignIn,
    });
  } else {
    if (!hasSignals) {
      todo.push({
        title: "Say what you're here for",
        body: "What you need, what you can offer, what you're into. Every recommendation in both directions is built from these, and without them you're unmatchable to everyone.",
        action: "Add your signals",
        onClick: onProfile,
      });
    }
    if (visibility === "off") {
      todo.push({
        title: "Put yourself on the map",
        body: "You're listed but you have no pin, so nobody can find you by being near you — which is the one thing this map does that a directory doesn't.",
        action: "Choose how you appear",
        onClick: onProfile,
      });
    } else if (visibility === "base") {
      todo.push({
        title: "Consider a fixed location",
        body: "A city circle makes you discoverable but not findable: nothing can answer “within 2 km” from it. A pin stays exactly where you put it.",
        action: "Change where you appear",
        onClick: onProfile,
      });
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Page>
        {/* ----------------------------------------------- the masthead */}
        <header className="reveal">
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--line)",
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--brand) 16%, var(--card)), color-mix(in srgb, var(--brand) 4%, var(--card)))",
            }}
          >
            <span
              className="grid h-[60px] w-[60px] place-items-center rounded-2xl text-white"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-deep))" }}
            >
              <IconGlobe size={28} />
            </span>
            <h1 className="mt-3 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em]">{BRAND_NAME}</h1>
            <p className="mt-1 max-w-[46ch] text-[13px] leading-[1.5] text-[var(--ink-soft)]">
              A map of people who said they&rsquo;re open to meeting someone. Not a feed, not a follower count —
              who is near you, what they&rsquo;re after, and why it&rsquo;s worth walking over.
            </p>
          </div>
        </header>

        {/* The first thing, when there is a first thing. */}
        {todo.length > 0 && (
          <Section
            title={signedIn ? "Finish setting up" : "Start here"}
            icon={<IconUser size={12} />}
            aside={todo.length > 1 ? `${todo.length} left` : undefined}
          >
            <ul className="stagger flex flex-col gap-2">
              {todo.map((t) => (
                <li key={t.title}>
                  <div
                    className="rounded-2xl border p-3.5"
                    style={{ borderColor: "var(--brand)", background: "var(--sunk)" }}
                  >
                    <p className="text-[13px] font-semibold">{t.title}</p>
                    <p className="mt-1 max-w-[56ch] text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">{t.body}</p>
                    <button type="button" className="btn btn-primary btn-sm mt-2.5" onClick={t.onClick}>
                      {t.action}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="reveal">
          <Stats>
            <Stat icon={<IconPeople size={14} />} value={peopleCount} label="on the map" onClick={onOpenPeople} />
            <Stat
              icon={<IconBeacon size={14} />}
              value={hereNowCount}
              label="out right now"
              tone={hereNowCount > 0 ? "good" : undefined}
              onClick={onOpenPins}
            />
            <Stat icon={<IconCalendar size={14} />} value={eventCount} label="events" onClick={onOpenEvents} />
            <Stat icon={<IconSparkle size={14} />} value={communityCount} label="your communities" />
          </Stats>
        </div>

        {/* ------------------------------------------------ how it works */}
        <Section title="How it works" icon={<IconSparkle size={12} />}>
          <ol className="flex flex-col gap-2.5">
            <Beat n={1} title="Everyone here chose to be here">
              Nobody is on this map by default. Each person picked whether to show a street-level pin, their city
              only, or nothing at all — and can change it in a tap.
            </Beat>
            <Beat n={2} title="Every recommendation says why">
              <button type="button" className="font-semibold" style={{ color: "var(--brand)" }} onClick={onOpenForYou}>
                For you
              </button>{" "}
              never shows a score. It shows a sentence — &ldquo;you&rsquo;re raising and they invest&rdquo; — that
              you can check against the profile next to it. If it can&rsquo;t explain itself, it doesn&rsquo;t
              appear.
            </Beat>
            <Beat n={3} title="Nobody can message you out of nowhere">
              There is no open inbox. Reaching someone is a connection request they have to accept, which is also
              why a connection here is worth something.
            </Beat>
          </ol>
        </Section>

        {/* ----------------------------------------------- where to use it */}
        <Section title="Where this is worth opening" icon={<IconPin size={12} />} hint="A map of people isn't a use. These are.">
          <ul className="grid gap-2 sm:grid-cols-2">
            <Use title="At a conference">
              Eight hundred badges and no idea who to talk to. Drop a fixed pin, run For you, and get five names
              with reasons.
            </Use>
            <Use title="A co-working day">
              You&rsquo;re working from a café anyway. See who else in the building is open to a coffee.
            </Use>
            <Use title="Landing in a new city">
              Switch on &ldquo;My network&rdquo; and see who you already know there before you book anything.
            </Use>
            <Use title="Your alumni or company group">
              Communities are private boards inside this. Members see each other whether or not they&rsquo;re on
              the public map — joining one is its own kind of consent.
            </Use>
            <Use title="Something happening tonight">
              Drop a pin that expires. &ldquo;Working from here till six, say hello&rdquo; — gone by morning.
            </Use>
            <Use title="Hiring, raising, or stuck">
              Say it once in your profile and it works in both directions, to everyone, without you posting
              anything.
            </Use>
          </ul>
        </Section>

        {/* ---------------------------------------------- the ground rules */}
        <Section title="Ground rules" icon={<IconCheck size={12} />}>
          {/* Statements about how the product behaves, not promises about
              moderation nobody is doing. Every line here is something the
              code actually enforces. */}
          <div
            className="rounded-2xl border-l-[3px] py-1 pl-3.5 pr-1"
            style={{ borderColor: "var(--brand)", borderRadius: "4px 16px 16px 4px", background: "var(--sunk)" }}
          >
            <ul className="flex flex-col gap-2 py-2 pr-2">
              <Rule icon={<IconUser size={12} />} title="Be who you say you are">
                There are no anonymous profiles here. A tick means a community you both belong to has confirmed
                that person is really one of theirs — it is never a claim this product makes on its own.
              </Rule>
              <Rule icon={<IconLock size={12} />} title="Your location stays yours">
                Off, your city, a fixed pin, or live while you&rsquo;re out. Live sharing stops on its own when you
                close the app. Changing your mind takes one tap and applies everywhere immediately.
              </Rule>
              <Rule icon={<IconPeople size={12} />} title="An introduction, not a broadcast">
                Connection requests carry one short note. No bulk messaging, no cold inbox, and nobody sees your
                contact details until you&rsquo;ve both agreed.
              </Rule>
              <Rule icon={<IconPin size={12} />} title="Show up as yourself">
                This only works if the person who walks over meets the person they read about. Say what you
                actually need — the vague profiles are the ones nothing can match.
              </Rule>
            </ul>
          </div>
        </Section>

        <Section title="Communities are different" icon={<IconPeople size={12} />}>
          <p className="max-w-[60ch] text-[12.5px] leading-[1.6] text-[var(--ink-soft)]">
            This map is the public square. A community — an alumni network, a company, a meetup group — is a
            private board inside it, with its own members, events, feed and front page. Members are visible to each
            other there even when they&rsquo;re off the public map, and the people running it can vouch for who is
            really one of theirs. You join one by scanning its code or following its link.
          </p>
          {signedIn && (
            <button type="button" className="btn btn-ghost btn-sm mt-2.5" onClick={onProfile}>
              Start a community
            </button>
          )}
        </Section>
      </Page>
    </div>
  );
}

function Beat({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mono grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold"
        style={{ background: "color-mix(in srgb, var(--brand) 13%, transparent)", color: "var(--brand)" }}
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{title}</span>
        <span className="mt-0.5 block max-w-[58ch] text-[12.5px] leading-[1.55] text-[var(--ink-soft)]">
          {children}
        </span>
      </span>
    </li>
  );
}

function Use({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <p className="text-[12.5px] font-semibold">{title}</p>
      <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--ink-soft)]">{children}</p>
    </li>
  );
}

function Rule({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[3px] flex-none" style={{ color: "var(--brand)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{title}</span>
        <span className="mt-0.5 block max-w-[58ch] text-[12px] leading-[1.5] text-[var(--ink-soft)]">{children}</span>
      </span>
    </li>
  );
}
