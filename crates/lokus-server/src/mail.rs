//! @part-of server
//! The one email the relay sends: an invitation to a workspace.
//!
//! Sending goes through Resend's HTTP API with a key from `LOKUS_MAIL_KEY`. Without a key, or
//! without `LOKUS_PUBLIC_URL` (the address the links in an email point back to), the relay
//! sends nothing and invites are handed over as links, as before.
//!
//! Two things in the email come from the person inviting: their name and the workspace's name.
//! Both are escaped, and a name that looks like an address or a link is not used, so the email
//! cannot be made to carry someone else's link under our name.

use serde_json::json;

use crate::store::{Invitation, Role};

/// The most invitation emails one account may have sent in a day.
pub const DAILY: i64 = 60;
/// Seconds before the same invitation can be emailed again.
pub const AGAIN: i64 = 60;

pub struct Mailer {
    key: String,
    from: String,
    /// Where email is handed over. Resend's, unless a test points it at itself.
    api: String,
    /// The relay's own public address, without a trailing slash.
    pub site: String,
    http: reqwest::Client,
}

impl Mailer {
    pub fn new(key: &str, from: &str, site: &str, api: Option<&str>) -> Self {
        Self {
            key: key.to_string(),
            from: from.to_string(),
            api: api.unwrap_or("https://api.resend.com/emails").to_string(),
            site: site.trim_end_matches('/').to_string(),
            http: reqwest::Client::new(),
        }
    }

    /// `None` when this relay is not set up to send email.
    pub fn from_env() -> Option<Self> {
        let read = |name: &str| std::env::var(name).ok().filter(|v| !v.trim().is_empty());
        let key = read("LOKUS_MAIL_KEY")?;
        let Some(site) = read("LOKUS_PUBLIC_URL") else {
            eprintln!(
                "warning: LOKUS_MAIL_KEY is set but LOKUS_PUBLIC_URL is not; no email will be sent"
            );
            return None;
        };
        let from = read("LOKUS_MAIL_FROM").unwrap_or_else(|| "Lokus <noreply@lokusmd.com>".into());
        Some(Self::new(
            &key,
            &from,
            &site,
            read("LOKUS_MAIL_API").as_deref(),
        ))
    }

    /// The page an invitation's link opens.
    pub fn link(&self, code: &str) -> String {
        format!("{}/join/{code}", self.site)
    }

    /// Email an invitation. The error is for the log; the caller words its own for the person.
    pub async fn invite(&self, invitation: &Invitation) -> Result<(), String> {
        let to = invitation.email.as_deref().ok_or("no address")?;
        let letter = Letter::of(invitation, &self.link(&invitation.code), &self.site);
        let mut body = json!({
            "from": self.from,
            "to": [to],
            "subject": letter.subject,
            "html": letter.html,
            "text": letter.text,
        });
        // A reply goes to the person who invited, not into a mailbox nobody reads.
        if let Some(from) = &invitation.from {
            body["reply_to"] = json!(from);
        }
        let answer = self
            .http
            .post(&self.api)
            .bearer_auth(&self.key)
            .timeout(std::time::Duration::from_secs(15))
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if answer.status().is_success() {
            return Ok(());
        }
        let status = answer.status();
        let said: String = answer
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(300)
            .collect();
        Err(format!("{status}: {said}"))
    }
}

/// An address we are willing to send to: one person, nothing a mail header could be bent with.
pub fn address(text: &str) -> Option<String> {
    let text = text.trim().to_lowercase();
    let (name, domain) = text.split_once('@')?;
    let plain = |c: char| c.is_ascii_alphanumeric() || "._%+-".contains(c);
    let ok = text.len() <= 254
        && !name.is_empty()
        && name.chars().all(plain)
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !domain.contains("..")
        && domain
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-');
    ok.then_some(text)
}

/// The name someone goes by, if it is safe to print in an email under our name.
pub fn name(text: &str) -> Option<String> {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let lower = text.to_lowercase();
    let ok = !text.is_empty()
        && text.chars().count() <= 60
        && !text.chars().any(|c| c.is_control() || "<>@/\\".contains(c))
        && !lower.contains("www.")
        && !lower.contains("http");
    ok.then_some(text)
}

pub fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

/// "Saturday 21 November", from seconds since 1970 (UTC).
pub fn day(at: i64) -> String {
    const DAYS: [&str; 7] = [
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
    ];
    const MONTHS: [&str; 12] = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    let days = at.div_euclid(86_400);
    // Days since 1970 to a calendar date (Howard Hinnant's civil_from_days).
    let z = days + 719_468;
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    format!(
        "{} {d} {}",
        DAYS[days.rem_euclid(7) as usize],
        MONTHS[(m - 1) as usize]
    )
}

/// What a role lets someone do, said to the person being given it.
pub fn may(role: Role) -> &'static str {
    match role {
        Role::Owner => "an owner: you can change everything and decide who else is in",
        Role::Editor => "an editor: you can read and change everything in the workspace",
        Role::Viewer => "a viewer: you can read everything in the workspace",
    }
}

/// Who an invitation is from, in the words used for them: their name, or their address.
pub fn sender(invitation: &Invitation) -> String {
    invitation
        .from_name
        .as_deref()
        .and_then(name)
        .or_else(|| invitation.from.clone())
        .unwrap_or_else(|| "Someone".into())
}

pub struct Letter {
    pub subject: String,
    pub html: String,
    pub text: String,
}

impl Letter {
    pub fn of(invitation: &Invitation, link: &str, site: &str) -> Self {
        let who = sender(invitation);
        let workspace = invitation.name.as_str();
        let to = invitation.email.as_deref().unwrap_or_default();
        let until = day(invitation.expires_at);
        let role = may(invitation.role);
        // Named by address when a name was given, so the person can tell who this really is.
        let by = match (
            &invitation.from,
            who != *invitation.from.as_deref().unwrap_or_default(),
        ) {
            (Some(from), true) => format!("{who} ({from})"),
            _ => who.clone(),
        };
        let subject = format!("{who} invited you to {workspace} on Lokus");
        let text = format!(
            "{by} invited you to {workspace} on Lokus.\n\n\
             Lokus is where a team keeps its customers, tasks and notes in one place.\n\
             You would join as {role}.\n\n\
             Accept the invitation:\n{link}\n\n\
             How it works:\n\
             1. Get Lokus for Mac. It is free.\n\
             2. Sign in as {to}.\n\
             3. Your invitation is waiting inside. Click Join.\n\n\
             The invitation works until {until}. Not expecting it? Ignore this email and nothing happens.\n"
        );
        let initial = workspace
            .chars()
            .find(|c| c.is_alphanumeric())
            .map(|c| c.to_uppercase().to_string())
            .unwrap_or_else(|| "L".into());
        let html = TEMPLATE
            .replace(
                "{{preheader}}",
                &escape(&format!(
                    "Join as {role}. The invitation works until {until}."
                )),
            )
            .replace("{{logo}}", &format!("{site}/brand/lokus.png"))
            .replace("{{who}}", &escape(&who))
            .replace("{{by}}", &escape(&by))
            .replace("{{workspace}}", &escape(workspace))
            .replace("{{initial}}", &escape(&initial))
            .replace(
                "{{from_email}}",
                &escape(invitation.from.as_deref().unwrap_or_default()),
            )
            .replace(
                "{{role_can}}",
                match invitation.role {
                    Role::Viewer => "Can read everything",
                    _ => "Can read and change everything",
                },
            )
            .replace("{{role_name}}", &escape(&capital(invitation.role.name())))
            .replace("{{to}}", &escape(to))
            .replace("{{until}}", &escape(&until))
            .replace("{{link}}", &escape(link));
        Self {
            subject,
            html,
            text,
        }
    }
}

pub fn capital(word: &str) -> String {
    let mut letters = word.chars();
    match letters.next() {
        Some(first) => first.to_uppercase().chain(letters).collect(),
        None => String::new(),
    }
}

/// Email is laid out with tables and styles on each element because that is all the big mail
/// programs keep. The colours are the app's own light theme; the `<style>` block turns it dark
/// in the programs that honour one.
const TEMPLATE: &str = include_str!("../assets/invitation.html");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_date_reads_as_a_day() {
        assert_eq!(day(0), "Thursday 1 January");
        assert_eq!(day(1_794_614_400), "Saturday 14 November");
        assert_eq!(day(1_709_164_800), "Thursday 29 February");
    }

    #[test]
    fn only_a_plain_address_is_sent_to() {
        assert_eq!(address(" Sam@Acme.io "), Some("sam@acme.io".into()));
        for bad in [
            "sam",
            "sam@acme",
            "a@b.io, c@d.io",
            "sam@acme.io\nbcc: x@y.io",
            "Sam <sam@acme.io>",
            "@acme.io",
            "sam@.io",
        ] {
            assert_eq!(address(bad), None, "{bad}");
        }
    }

    #[test]
    fn a_name_cannot_smuggle_a_link() {
        assert_eq!(name("  Pratham   Patel "), Some("Pratham Patel".into()));
        for bad in [
            "Click https://evil.example",
            "www.evil.example",
            "a@b.io",
            "<b>hi</b>",
            "",
        ] {
            assert_eq!(name(bad), None, "{bad}");
        }
    }

    #[test]
    fn the_letter_escapes_what_people_typed() {
        let invitation = Invitation {
            code: "abc".into(),
            workspace: "w".into(),
            name: "Acme <script>alert(1)</script>".into(),
            role: Role::Editor,
            from: Some("alice@x.io".into()),
            from_name: Some("Alice".into()),
            email: Some("bob@x.io".into()),
            expires_at: 1_794_614_400,
            sent_at: None,
        };
        let letter = Letter::of(
            &invitation,
            "https://relay.example/join/abc",
            "https://relay.example",
        );
        assert!(!letter.html.contains("<script>"));
        assert!(letter.html.contains("Acme &lt;script&gt;"));
        assert!(letter.html.contains("https://relay.example/join/abc"));
        assert!(letter.html.contains("alice@x.io"));
        assert!(letter.text.contains("Alice (alice@x.io)"));
        assert!(!letter.html.contains("{{"));
        assert_eq!(
            letter.subject,
            "Alice invited you to Acme <script>alert(1)</script> on Lokus"
        );
    }
}
