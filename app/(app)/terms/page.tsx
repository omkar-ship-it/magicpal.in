import Link from "next/link";
import LegalDoc, { Clause } from "@/components/LegalDoc";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: `Terms & Conditions — ${LEGAL.brand}`,
  description:
    "The rules for using OpenNetworks: who may join, how to behave, what we promise, and what we do not.",
};

/**
 * The terms.
 *
 * Two clauses here are doing real work rather than filling a template.
 * §7 says plainly that an introduction on a screen is not a vouch for a
 * stranger in a room, which is the actual risk of a product that tells
 * people where other people are. §9 says what a verification tick means and
 * — more importantly — what it does not, because a badge nobody can
 * interpret is worse than no badge.
 */
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms & Conditions"
      summary={`These are the rules for using ${LEGAL.brand}. They are a contract between you and us, so they are written to be read rather than to be survived.`}
      other={{ href: "/privacy", label: "Privacy Policy" }}
    >
      <Clause n={1} title="Agreeing to these terms">
        <p>
          By creating an account you agree to these terms and to the{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not create an account. If you use {LEGAL.brand} on behalf of an
          organisation, you confirm you are authorised to bind it.
        </p>
      </Clause>

      <Clause n={2} title="Who may use it">
        <p>
          You must be at least {LEGAL.minimumAge} years old. You must not be barred from using the service
          under the laws that apply to you, and you must not have been removed from {LEGAL.brand} previously.
        </p>
        <p>
          One account per person. Your profile must describe you, with a real name and an accurate account of
          what you do. A profile that impersonates somebody else, invents an employer, or represents a company
          rather than a person is grounds for removal.
        </p>
      </Clause>

      <Clause n={3} title="Your account">
        <p>
          Signing in is a one-time code sent to your email address, so your account is only as secure as that
          inbox. Keep it secure, and tell us promptly if you believe someone else has reached your account.
        </p>
        <p>
          You are responsible for what is done through your account. You can sign out of a session at any
          time, and delete the account entirely from your profile.
        </p>
      </Clause>

      <Clause n={4} title="What the service is">
        <p>
          {LEGAL.brand} shows you people who have said they are open to meeting someone, where they are, what
          they are looking for, and what they can help with. It suggests who might be worth meeting and tells
          you why.
        </p>
        <p>
          It is an introduction surface and nothing more. We do not employ, endorse, screen, background-check
          or vet members. We do not promise that you will be matched, that anybody will reply, that a meeting
          will happen, or that it will be worth your time.
        </p>
      </Clause>

      <Clause n={5} title="What you post">
        <p>
          You keep ownership of everything you write, upload and share. You grant us a non-exclusive,
          worldwide, royalty-free licence to host, store, reproduce and display it for the sole purpose of
          operating the service — showing your profile to the boards you joined, delivering your message to
          its recipient, rendering your post in a feed. That licence ends when you delete the content, except
          for copies already delivered to other people and for backups until they expire.
        </p>
        <p>
          You confirm that you have the right to post what you post, and that it does not infringe anyone
          else’s rights.
        </p>
      </Clause>

      <Clause n={6} title="How to behave">
        <p>You must not:</p>
        <ul className="ml-5 list-disc">
          <li>harass, threaten, stalk, or make unwanted advances to anybody, here or after meeting them;</li>
          <li>use someone’s published location to find them without their agreement, follow them, or turn up where they are uninvited;</li>
          <li>send bulk or repeated unsolicited sales messages, recruitment spam, or chain messages;</li>
          <li>post anything unlawful, defamatory, obscene, hateful, or that discloses somebody else’s private information;</li>
          <li>scrape, crawl, bulk-export or otherwise systematically collect member data, by any means, including building a copy of the directory;</li>
          <li>attempt to bypass visibility settings, access another account, or probe the service’s security;</li>
          <li>misrepresent who you are, who you work for, or who vouched for you;</li>
          <li>use the service to recruit for, or promote, anything illegal.</li>
        </ul>
        <p>
          Scraping deserves its own sentence: the entire premise of this product is that people publish where
          they are because the audience is bounded. Collecting that into a dataset breaks the promise every
          member relied on when they switched their location on, and we will treat it as seriously as that
          description implies.
        </p>
      </Clause>

      <Clause n={7} title="Meeting people — your safety is yours">
        <p>
          This is the clause worth reading twice. {LEGAL.brand} will tell you that somebody nearby is working
          on something adjacent to what you are working on. That is all it is telling you. It is not a
          character reference.
        </p>
        <p>
          Meet in public places. Tell somebody where you are going. Judge people as you would judge any
          stranger who emailed you out of the blue, because that is exactly what they are. Decide for yourself
          what to publish about your location, and remember that “exact” means exact.
        </p>
        <p>
          We are not a party to anything that happens between members, online or in person, and to the fullest
          extent the law allows we are not liable for it. If somebody behaves badly, report them — see §11.
        </p>
      </Clause>

      <Clause n={8} title="Boards">
        <p>
          A board is a community or an event with its own members. Joining one makes you visible to its
          members and is your consent to that; leaving it ends that visibility.
        </p>
        <p>
          If you host a board you are responsible for what happens on it: who you admit, what is posted, and
          the accuracy of anything you publish about it. You must not use a board’s member list for anything
          other than running that board — a board is not a lead list, and exporting one is covered by §6.
        </p>
        <p>
          We may remove a board, or a host, that is used to harvest members or to misrepresent what people are
          joining.
        </p>
      </Clause>

      <Clause n={9} title="Verification, and its limits">
        <p>
          A verification tick means that a community both of you belong to has said this person really is who
          they claim to be, within that community. It is a statement by that community.
        </p>
        <p>
          It is not an identity check by us, not a background check, not a statement about character or
          competence, and not transferable to any other context. An unverified member is not suspect; a
          verified one is not vouched for by us.
        </p>
      </Clause>

      <Clause n={10} title="Our side">
        <p>
          We will try to keep the service running, but we do not guarantee it will be available, uninterrupted
          or free of errors, and we may change, suspend or discontinue features. We will give reasonable
          notice before discontinuing something people rely on, unless we cannot.
        </p>
        <p>
          The service is provided “as is”. To the fullest extent permitted by law we exclude all implied
          warranties, including fitness for a particular purpose and non-infringement.
        </p>
      </Clause>

      <Clause n={11} title="Reporting, suspension and removal">
        <p>
          Report anything that breaks §6 to{" "}
          <a className="underline" href={`mailto:${LEGAL.supportEmail}`}>
            {LEGAL.supportEmail}
          </a>{" "}
          or to the Grievance Officer in the{" "}
          <Link href="/privacy#s12" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          We may remove content, restrict features, or suspend or end an account where we reasonably believe
          these terms have been broken, where the law requires it, or where somebody is at risk. Where it is
          proportionate we will tell you why and give you a route to respond; where somebody is in danger we
          will act first.
        </p>
        <p>You may delete your account at any time, for any reason, without asking us.</p>
      </Clause>

      <Clause n={12} title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for indirect, incidental, special,
          consequential or punitive losses, nor for lost profits, lost opportunities, lost data, or losses
          arising from your dealings with other members.
        </p>
        <p>
          Our total liability to you for all claims relating to the service is limited to the greater of the
          amount you paid us in the twelve months before the claim, or ₹5,000.
        </p>
        <p>
          Nothing here excludes liability that cannot lawfully be excluded, including for death or personal
          injury caused by negligence, or for fraud.
        </p>
      </Clause>

      <Clause n={13} title="Indemnity">
        <p>
          You agree to indemnify us against claims, losses and reasonable legal costs arising from your breach
          of these terms, your content, or your conduct towards other members.
        </p>
      </Clause>

      <Clause n={14} title="Third-party services">
        <p>
          Maps, email delivery, hosting and file storage are provided by the third parties listed in the{" "}
          <Link href="/privacy#s6" className="underline">
            Privacy Policy
          </Link>
          . Links a member puts on their profile lead to sites we do not control and are not responsible for.
        </p>
      </Clause>

      <Clause n={15} title="Changes to these terms">
        <p>
          We may update these terms. If a change affects your rights or obligations we will raise the version,
          show you what changed, and ask you to accept it before you continue using the service. Continuing to
          use {LEGAL.brand} after a minor correction means you accept it.
        </p>
      </Clause>

      <Clause n={16} title="Law and disputes">
        <p>
          These terms are governed by the laws of {LEGAL.jurisdiction}. The courts at {LEGAL.venue} have
          exclusive jurisdiction, except that if you are a consumer resident elsewhere, nothing here deprives
          you of the protection of the mandatory laws of your own country.
        </p>
        <p>
          Before starting proceedings, please write to us — most things are resolved faster that way than by
          either of us paying a lawyer.
        </p>
      </Clause>

      <Clause n={17} title="General">
        <p>
          If a clause is held unenforceable, the rest stands. Our not enforcing something is not a waiver of
          it. You may not transfer your rights under these terms; we may transfer ours as part of a
          reorganisation or sale of the business, on notice to you.
        </p>
        <p>
          These terms and the{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          are the whole agreement between us about the service.
        </p>
      </Clause>

      <Clause n={18} title="Contact">
        <p>
          {LEGAL.operator}
          {LEGAL.registeredAddress ? `, ${LEGAL.registeredAddress}` : ""} —{" "}
          <a className="underline" href={`mailto:${LEGAL.supportEmail}`}>
            {LEGAL.supportEmail}
          </a>
          .
        </p>
      </Clause>
    </LegalDoc>
  );
}
