//! @part-of calendar
//! The one set of things Lokus asks of a calendar provider, answered by Google or Microsoft.

use crate::model::{Account, Calendar, Event, Provider, Result};
use crate::{google, microsoft};

pub enum Change {
    Put(Box<Event>),
    /// The provider's id of an event that is gone.
    Gone(String),
}

/// When someone is busy, as their provider tells it: times only.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Busy {
    pub email: String,
    /// False when this provider cannot see that person's calendar.
    pub known: bool,
    pub times: Vec<(String, String)>,
}

pub fn enc(text: &str) -> String {
    url::form_urlencoded::byte_serialize(text.as_bytes()).collect()
}

pub async fn calendars(a: &Account) -> Result<Vec<Calendar>> {
    match a.provider {
        Provider::Google => google::calendars(&a.id).await,
        Provider::Microsoft => microsoft::calendars(&a.id).await,
    }
}

pub async fn changes(
    a: &Account,
    calendar: &str,
    position: Option<&str>,
    from: &str,
    to: &str,
) -> Result<(Vec<Change>, String)> {
    match a.provider {
        Provider::Google => google::changes(&a.id, calendar, position, from, to).await,
        Provider::Microsoft => microsoft::changes(&a.id, calendar, position, from, to).await,
    }
}

pub async fn create(a: &Account, calendar: &str, e: &Event, notify: bool) -> Result<Event> {
    match a.provider {
        Provider::Google => google::create(&a.id, calendar, e, notify).await,
        Provider::Microsoft => microsoft::create(&a.id, calendar, e).await,
    }
}

pub async fn update(
    a: &Account,
    calendar: &str,
    id: &str,
    e: &Event,
    changed: &[String],
    notify: bool,
) -> Result<Event> {
    match a.provider {
        Provider::Google => google::update(&a.id, calendar, id, e, changed, notify).await,
        Provider::Microsoft => microsoft::update(&a.id, calendar, id, e, changed).await,
    }
}

pub async fn get(a: &Account, calendar: &str, id: &str) -> Result<Event> {
    match a.provider {
        Provider::Google => google::get(&a.id, calendar, id).await,
        Provider::Microsoft => microsoft::get(&a.id, calendar, id).await,
    }
}

pub async fn delete(a: &Account, calendar: &str, id: &str, notify: bool) -> Result<()> {
    match a.provider {
        Provider::Google => google::delete(&a.id, calendar, id, notify).await,
        Provider::Microsoft => microsoft::delete(&a.id, id).await,
    }
}

pub async fn reply(a: &Account, calendar: &str, id: &str, answer: &str) -> Result<()> {
    match a.provider {
        Provider::Google => google::reply(&a.id, calendar, id, &a.email, answer).await,
        Provider::Microsoft => microsoft::reply(&a.id, id, answer).await,
    }
}

pub async fn busy(a: &Account, emails: &[String], from: &str, to: &str) -> Result<Vec<Busy>> {
    match a.provider {
        Provider::Google => google::busy(&a.id, emails, from, to).await,
        Provider::Microsoft => microsoft::busy(&a.id, emails, from, to).await,
    }
}

/// Who signed in: (email, name).
pub async fn me(provider: Provider, slot: &str) -> Result<(String, String)> {
    match provider {
        Provider::Google => {
            let listed = google::calendars(slot).await?;
            let main = listed.into_iter().find(|c| c.primary);
            let email = main.as_ref().map(|c| c.id.clone()).unwrap_or_default();
            Ok((
                email.clone(),
                main.map(|c| c.name)
                    .filter(|n| !n.contains('@'))
                    .unwrap_or(email),
            ))
        }
        Provider::Microsoft => microsoft::me(slot).await,
    }
}
