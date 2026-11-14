/** @part-of ui.updates */
import { useEffect, useRef } from "react";

import { DOWNLOAD_PAGE, openWeb, type Post, UPDATE_SERVER } from "../../bridge/updates";
import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { renderMarkdown } from "../../shell/workspace";
import { Row, Section } from "../settings/parts";
import { applies, check, closeNews, install, later, readNews, restart, updates } from "./updates";

const day = (at: number) => new Date(at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/**
 * The update pop-up, in the corner where it does not stop anyone typing. It says one thing at a
 * time and always says what happens next, for someone who has never updated an app by hand.
 */
export function UpdateCard() {
  const s = useStore(updates, (state) => state);
  if (!s.card || s.phase === "idle" || s.phase === "checking") return null;
  const about = s.posts.find((p) => p.version === s.version);
  const percent = s.fraction === null ? null : Math.round(s.fraction * 100);

  return (
    <aside className={`update-card ${s.phase}`} role="status" aria-live="polite">
      {s.phase === "available" && (
        <>
          <h3>A new version of Lokus is ready</h3>
          {s.blocked ? (
            <p className="update-warn">{s.blocked}</p>
          ) : (
            <p>
              Version {s.version}. It takes about a minute. Your notes stay exactly as they are.
            </p>
          )}
          <div className="update-actions">
            {s.blocked ? (
              <button className="primary" onClick={() => void check(true)}>
                I moved it, check again
              </button>
            ) : (
              <button className="primary" onClick={() => void install()}>
                Update now
              </button>
            )}
            {about && (
              <button className="settings-button" onClick={() => readNews(about.id)}>
                See what’s new
              </button>
            )}
            <button className="link" onClick={later}>
              Later
            </button>
          </div>
        </>
      )}

      {(s.phase === "downloading" || s.phase === "installing") && (
        <>
          <h3>{s.phase === "installing" ? "Installing the update" : "Downloading the update"}</h3>
          <div className={`update-bar${percent === null || s.phase === "installing" ? " busy" : ""}`}>
            <span style={{ width: `${s.phase === "installing" ? 100 : (percent ?? 30)}%` }} />
          </div>
          <p>{s.phase === "installing" ? "Almost done. Do not quit Lokus yet." : `${percent === null ? "Working on it" : `${percent}% done`}. You can keep working while this finishes.`}</p>
        </>
      )}

      {s.phase === "ready" && (
        <>
          <h3>The update is installed</h3>
          <p>Restart Lokus to start using version {s.version}. Lokus will close and open again by itself.</p>
          <p className="update-note">If Lokus has not come back after 10 seconds, open it again yourself, the same way you always do. The update is already in and nothing is lost.</p>
          <div className="update-actions">
            <button className="primary" onClick={() => void restart()}>
              Restart now
            </button>
            <button className="link" onClick={later}>
              Later
            </button>
          </div>
        </>
      )}

      {s.phase === "restarting" && (
        <>
          <h3>Restarting Lokus…</h3>
          <div className="update-bar busy">
            <span style={{ width: "100%" }} />
          </div>
          <p className="update-note">If Lokus has not come back after 10 seconds, open it again yourself. The update is already in and nothing is lost.</p>
        </>
      )}

      {s.phase === "failed" && (
        <>
          <h3>The update did not finish</h3>
          <p className="update-warn">{s.error}</p>
          <p className="update-note">Lokus is still working on the version you had. Nothing is lost.</p>
          <div className="update-actions">
            <button className="primary" onClick={() => void install()}>
              Try again
            </button>
            <button className="settings-button" onClick={() => openWeb(DOWNLOAD_PAGE)}>
              Download it yourself
            </button>
            <button className="link" onClick={later}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

/** A way to play a video from where it is kept: a file plays here, YouTube and Loom in their player. */
function player(video: string): { kind: "file" | "frame"; src: string } | null {
  if (!video) return null;
  const youtube = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(video);
  if (youtube) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0` };
  const loom = /loom\.com\/(?:share|embed)\/([\w-]+)/.exec(video);
  if (loom) return { kind: "frame", src: `https://www.loom.com/embed/${loom[1]}` };
  return { kind: "file", src: video };
}

function Media({ post }: { post: Post }) {
  const play = player(post.video);
  if (play?.kind === "frame") return <iframe className="news-media" src={play.src} title={post.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  // Starts by itself without sound, the way a demo should: nothing to press, nothing blaring.
  if (play) return <video className="news-media" src={play.src} poster={post.image || undefined} autoPlay muted loop playsInline controls />;
  if (post.image) return <img className="news-media" src={post.image} alt="" />;
  return null;
}

function Body({ text }: { text: string }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => (mount.current ? renderMarkdown(mount.current, text) : undefined), [text]);
  return <div className="news-body" ref={mount} />;
}

/** "What's new": one post with its video, or everything that has been published. */
export function WhatsNew() {
  const reading = useStore(updates, (s) => s.reading);
  const posts = useStore(updates, (s) => s.posts);
  const seen = useStore(updates, (s) => s.seen);
  const current = useStore(updates, (s) => s.current);
  const phase = useStore(updates, (s) => s.phase);
  const offered = useStore(updates, (s) => s.version);
  useEffect(() => {
    if (!reading) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeNews();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [reading]);
  if (!reading) return null;
  const post = posts.find((p) => p.id === reading);
  const ahead = (p: Post) => !applies(p, current);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && closeNews()}>
      <div className="news" role="dialog" aria-label="What’s new in Lokus">
        <button className="news-close" aria-label="Close" onClick={closeNews}>
          <Icon name="close" />
        </button>
        {post ? (
          <>
            <Media post={post} />
            <div className="news-text">
              <p className="news-when">
                {post.version ? `Version ${post.version}` : "From the Lokus team"}
                <span>{day(post.at)}</span>
              </p>
              <h2>{post.title}</h2>
              {post.summary && <p className="news-summary">{post.summary}</p>}
              {post.body && <Body text={post.body} />}
            </div>
            <footer className="news-foot">
              {posts.length > 1 && (
                <button className="link" onClick={() => readNews("all")}>
                  Everything that’s new
                </button>
              )}
              <span />
              {post.link && (
                <button className="settings-button" onClick={() => openWeb(post.link)}>
                  {post.link_label || "Learn more"}
                </button>
              )}
              {ahead(post) && phase === "available" && offered === post.version ? (
                <button
                  className="primary"
                  onClick={() => {
                    closeNews();
                    void install();
                  }}
                >
                  Update now
                </button>
              ) : (
                <button className="primary" onClick={closeNews}>
                  Got it
                </button>
              )}
            </footer>
          </>
        ) : (
          <>
            <div className="news-text list">
              <h2>What’s new in Lokus</h2>
              {posts.length === 0 && <p className="news-summary">Nothing yet. When we ship something, you will read about it here.</p>}
            </div>
            <div className="news-list">
              {posts.map((p) => (
                <button key={p.id} onClick={() => readNews(p.id)}>
                  {p.image ? <img src={p.image} alt="" /> : <span className="news-thumb">{p.video ? <Icon name="play" /> : <Icon name="news" />}</span>}
                  <span className="news-row">
                    <strong>
                      {!seen.includes(p.id) && <i aria-label="New" />}
                      {p.title}
                    </strong>
                    {p.summary && <small>{p.summary}</small>}
                    <em>
                      {day(p.at)}
                      {p.version && <span>{ahead(p) ? `Comes with version ${p.version}` : `Version ${p.version}`}</span>}
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The sidebar's way back in: news, with a dot when something is unread, and a waiting update. */
export function NewsButton() {
  const unread = useStore(updates, (s) => s.posts.some((p) => !s.seen.includes(p.id)));
  const phase = useStore(updates, (s) => s.phase);
  const card = useStore(updates, (s) => s.card);
  const waiting = !card && (phase === "available" || phase === "ready" || phase === "failed");
  if (!UPDATE_SERVER) return null;
  // A waiting update takes the megaphone's place, so the person's name keeps its room.
  if (waiting) {
    return (
      <button className="update-pill" title={phase === "ready" ? "Restart to finish updating" : "A new version is ready"} onClick={() => updates.set({ card: true })}>
        {phase === "ready" ? "Restart" : "Update"}
      </button>
    );
  }
  return (
    <button className="account-gear" title="What’s new" aria-label={unread ? "What’s new, unread" : "What’s new"} onClick={() => readNews("all")}>
      <Icon name="news" />
      {unread && <i className="news-dot" />}
    </button>
  );
}

/** Settings, Updates: which version this is, and a button for people who like to be sure. */
export function UpdateSettings() {
  const s = useStore(updates, (state) => state);
  const busy = s.phase === "checking" || s.phase === "downloading" || s.phase === "installing";
  return (
    <Section title="Updates" hint="Lokus looks for new versions by itself and asks before installing one. You never have to download anything by hand.">
      <Row label={`Lokus ${s.current || ""}`} hint={s.phase === "checking" ? "Checking…" : s.phase === "ready" ? `Version ${s.version} is installed. Restart Lokus to start using it.` : s.said || "Lokus checks every half hour while it is open."}>
        {s.phase === "ready" ? (
          <button className="primary" onClick={() => void restart()}>
            Restart now
          </button>
        ) : s.phase === "available" ? (
          <button className="primary" disabled={Boolean(s.blocked)} onClick={() => void install()}>
            Update now
          </button>
        ) : (
          <button className="settings-button" disabled={busy || !UPDATE_SERVER} onClick={() => void check(true)}>
            Check for updates
          </button>
        )}
      </Row>
      <Row label="What’s new" hint="Everything we have shipped and announced, newest first.">
        <button className="settings-button" onClick={() => readNews("all")}>
          See what’s new
        </button>
      </Row>
    </Section>
  );
}
