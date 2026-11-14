/** @part-of ui.profile */
import { type PointerEvent, useEffect, useRef, useState } from "react";

import { Icon } from "../../shell/Icon";
import { app, notify, resolveImage } from "../../shell/workspace";
import { Row, Section } from "../settings/parts";
import { profileNamed, savePicture, saveProfile, useMe, useProfiles } from "./profiles";

/** Someone's picture, or their initial when they have none. */
export function Avatar({ name, picture, size = 28 }: { name: string; picture?: string; size?: number }) {
  const src = picture ? resolveImage(picture) : null;
  // A picture that will not load (a photo address that has expired, say) gives way to the initial.
  const [broken, setBroken] = useState<string | null>(null);
  return src && broken !== src ? (
    // No referrer: photo hosts such as Google's refuse a request that says which app it came from.
    <img className="avatar" src={src} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size }} onError={() => setBroken(src)} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/** A name with the face that goes with it, when someone on the team goes by that name. */
export function Face({ name, size = 18 }: { name: string; size?: number }) {
  const profiles = useProfiles();
  if (!name) return null;
  return (
    <span className="face">
      <Avatar name={name} picture={profileNamed(profiles, name)?.picture} size={size} />
      {name}
    </span>
  );
}

/** The side of the square a picture is framed in, and of the picture that is saved. */
const STAGE = 300;
const SAVED = 512;
const MAX_ZOOM = 4;

/**
 * Frame a picture for a round avatar: drag it into place, zoom with the slider or the wheel.
 * What shows inside the circle is what is kept, as a square picture.
 */
function Crop({ file, onDone, onCancel }: { file: File; onDone(image: string): void; onCancel(): void }) {
  const [source, setSource] = useState<{ url: string; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [at, setAt] = useState({ x: 0, y: 0 });
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setSource({ url, width: probe.naturalWidth, height: probe.naturalHeight });
      const fit = STAGE / Math.min(probe.naturalWidth, probe.naturalHeight);
      setAt({ x: (STAGE - probe.naturalWidth * fit) / 2, y: (STAGE - probe.naturalHeight * fit) / 2 });
    };
    probe.onerror = () => {
      notify("That picture could not be opened");
      onCancel();
    };
    probe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, onCancel]);

  // The picture at zoom 1 just covers the square; it can never be moved to leave a gap.
  const fit = source ? STAGE / Math.min(source.width, source.height) : 1;
  const shown = source ? { width: source.width * fit * zoom, height: source.height * fit * zoom } : { width: STAGE, height: STAGE };
  const held = (x: number, y: number, size = shown) => ({
    x: Math.min(0, Math.max(STAGE - size.width, x)),
    y: Math.min(0, Math.max(STAGE - size.height, y)),
  });

  const zoomTo = (next: number) => {
    if (!source) return;
    const z = Math.min(MAX_ZOOM, Math.max(1, next));
    // Keep whatever is at the middle of the frame in the middle.
    const centre = { x: (STAGE / 2 - at.x) / shown.width, y: (STAGE / 2 - at.y) / shown.height };
    const size = { width: source.width * fit * z, height: source.height * fit * z };
    setZoom(z);
    setAt(held(STAGE / 2 - centre.x * size.width, STAGE / 2 - centre.y * size.height, size));
  };
  const drag = (e: PointerEvent) => {
    e.preventDefault();
    const from = { x: e.clientX - at.x, y: e.clientY - at.y };
    const move = (ev: globalThis.PointerEvent) => setAt(held(ev.clientX - from.x, ev.clientY - from.y));
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  const apply = () => {
    if (!source || !image.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = SAVED;
    canvas.height = SAVED;
    const scale = fit * zoom;
    canvas.getContext("2d")?.drawImage(image.current, -at.x / scale, -at.y / scale, STAGE / scale, STAGE / scale, 0, 0, SAVED, SAVED);
    onDone(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="crop-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog crop" role="dialog" aria-label="Frame your picture">
        <h2>Frame your picture</h2>
        <p className="dialog-sub">Drag to move it. What is inside the circle is what people see.</p>
        <div className="crop-stage" style={{ width: STAGE, height: STAGE }} onPointerDown={drag} onWheel={(e) => zoomTo(zoom - e.deltaY * 0.002)}>
          {source && <img ref={image} src={source.url} alt="" draggable={false} style={{ width: shown.width, height: shown.height, transform: `translate(${at.x}px, ${at.y}px)` }} />}
          <span className="crop-ring" />
        </div>
        <label className="crop-zoom">
          <Icon name="minus" size={14} />
          <input type="range" aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} />
          <Icon name="plus" size={14} />
        </label>
        <div className="crop-actions">
          <button
            className="link"
            onClick={() => {
              setZoom(1);
              if (source) setAt({ x: (STAGE - source.width * fit) / 2, y: (STAGE - source.height * fit) / 2 });
            }}
          >
            Reset
          </button>
          <button className="settings-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" disabled={!source} onClick={apply}>
            Save picture
          </button>
        </div>
      </div>
    </div>
  );
}

const SIGNED_IN: Record<string, string> = { google: "Signed in with Google", email: "Signed in with a password" };

/** Settings, Profile: the name, role and picture the rest of the team sees. */
export function ProfileSettings() {
  const me = useMe();
  const [name, setName] = useState(me?.name ?? "");
  const [role, setRole] = useState(me?.role ?? "");
  const [menu, setMenu] = useState(false);
  const [chosen, setChosen] = useState<File | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => setName(me?.name ?? ""), [me?.name]);
  useEffect(() => setRole(me?.role ?? ""), [me?.role]);

  if (!me) {
    return (
      <Section title="Profile" hint="Sign in to have a name and a picture your team can see.">
        <Row label="Not signed in" hint="Your notes work without an account. An account is for sync and teams.">
          <button className="settings-button" onClick={() => app.set({ settings: null, accountDialog: true })}>
            Sign in
          </button>
        </Row>
      </Section>
    );
  }

  const failed = (e: unknown) => notify(e instanceof Error ? e.message : String(e));
  const rename = () => {
    const next = name.trim();
    if (!next || next === me.name) return setName(me.name);
    void saveProfile(me.email, { name: next }).catch(failed);
  };
  const describe = () => {
    if (role.trim() !== me.role) void saveProfile(me.email, { role }).catch(failed);
  };
  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("That is not a picture");
    setChosen(file);
  };

  return (
    <Section title="Profile" hint="How you appear to the people you work with: on tasks, in the team list and beside your edits.">
      <div className="profile-rows">
        <div className="profile-row">
          <div>
            <strong>Picture</strong>
            <small>A photo helps your team spot you. You frame it after choosing it.</small>
          </div>
          <span className="profile-picture-at">
            <button className="profile-picture" aria-label="Change your picture" aria-expanded={menu} onClick={() => (me.picture ? setMenu((m) => !m) : upload.current?.click())}>
              <Avatar name={me.name} picture={me.picture} size={64} />
              <span className="profile-edit">
                <Icon name="compose" size={12} />
              </span>
            </button>
            {menu && (
              <>
                <div className="cust-shade" onClick={() => setMenu(false)} />
                <div className="cust-menu">
                  <button
                    onClick={() => {
                      setMenu(false);
                      upload.current?.click();
                    }}
                  >
                    <Icon name="addCover" size={14} />
                    Choose a new picture
                  </button>
                  <button
                    onClick={() => {
                      setMenu(false);
                      void saveProfile(me.email, { picture: null }).catch(failed);
                    }}
                  >
                    <Icon name="close" size={14} />
                    Remove picture
                  </button>
                </div>
              </>
            )}
          </span>
          <input
            ref={upload}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="profile-row">
          <div>
            <strong>Name</strong>
            <small>Shown instead of your email address everywhere in the workspace.</small>
          </div>
          <input value={name} aria-label="Your name" onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        </div>

        <div className="profile-row">
          <div>
            <strong>What you do</strong>
            <small>A few words beside your name in the team list, such as Founder or Support.</small>
          </div>
          <input value={role} placeholder="Not said" aria-label="What you do" onChange={(e) => setRole(e.target.value)} onBlur={describe} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        </div>

        <div className="profile-row">
          <div>
            <strong>Email</strong>
            <small>{SIGNED_IN[me.provider] ?? "The address you sign in with"}. It cannot be changed here.</small>
          </div>
          <span className="settings-value">{me.email}</span>
        </div>

        <div className="profile-row">
          <div>
            <strong>Sign out</strong>
            <small>Your notes stay on this computer. Sync stops until you sign in again.</small>
          </div>
          <button className="settings-button" onClick={() => void import("../../shell/commands").then((c) => c.runCommand("account.signOut"))}>
            Sign out
          </button>
        </div>
      </div>

      {chosen && (
        <Crop
          file={chosen}
          onCancel={() => setChosen(null)}
          onDone={(image) => {
            setChosen(null);
            void savePicture(me.email, image).catch(failed);
          }}
        />
      )}
    </Section>
  );
}
