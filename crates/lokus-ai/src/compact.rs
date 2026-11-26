//! @part-of ai
//! Making room in a long conversation. The model writes a summary of the earlier part, and the
//! conversation carries on from that summary and the most recent turns. The person can say what
//! to keep and what to drop. Nothing is deleted: the window keeps the whole conversation on disk
//! and shows it; only what is sent to the model gets shorter.

use serde::Serialize;
use serde_json::{json, Value};

use crate::config::{Config, Provider};
use lokus_core::Core;

use crate::error::{AiError, Result};
use crate::provider;

/// How full the model's room may get before the conversation is compacted by itself.
const FULL: f64 = 0.8;
/// How much of the newest conversation is carried over word for word, in characters.
const KEEP_RECENT: usize = 24_000;
/// The most of one tool result the summariser is shown.
const RESULT_SHOWN: usize = 1_500;
/// The most conversation the summariser is shown when the model's room is not known.
const TRANSCRIPT: usize = 300_000;
/// Marks the message that holds a summary, so it can be told apart from what the person wrote.
pub const SUMMARY_TAG: &str = "<conversation_summary>";

const SUMMARISER: &str = "You are compacting a conversation between a user and the assistant inside Lokus, a notes app, so that it can go on after the earlier part is put away. Write the summary the assistant will continue from. It replaces the earlier messages, so anything not in it is forgotten.

Keep, in this order and under these headings:
## What the user wants
Their goals and their latest request, the latest in their own words.
## Decisions
What was decided and why, with every number, date, name and price exactly as stated.
## What was found
Facts learned from notes, files and connected services, naming notes as [[wikilinks]] and files by path.
## What was changed
Notes, tasks, customers or files that were created or changed, and anything the user declined.
## Still to do
What is unfinished or was promised.

Leave out pleasantries, repeated attempts and raw tool output. Be specific rather than short: an exact figure beats a description of it. If the user gave a note on what to keep or drop, it overrides everything above: keep in full what it asks to keep, and leave out entirely what it asks to drop, without mentioning that it was dropped. Write plain Markdown.

Put the summary, and nothing else, between <summary> and </summary>. Only what is between them is kept; a reply without them is thrown away and the conversation is left as it was.";

/// How many tokens the chosen model can hold, when that is known. `LOKUS_CONTEXT_LIMIT` says it
/// for a model this list does not know (a compatible service, a stand-in).
pub fn limit(config: &Config) -> Option<u64> {
    if let Some(told) = std::env::var("LOKUS_CONTEXT_LIMIT")
        .ok()
        .and_then(|v| v.parse().ok())
    {
        return Some(told);
    }
    let model = config.model().ok()?.to_lowercase();
    // A compatible service at another address may serve a model under a borrowed name.
    if config.provider == Provider::OpenAi
        && !config
            .url()
            .eq_ignore_ascii_case(Provider::OpenAi.default_url())
    {
        return None;
    }
    window(config.provider, &model)
}

/// How many tokens of conversation the provider says a model takes; none for a model it does
/// not list, so nothing is assumed about a name that is new here. Read on 2026-11-26 from
/// platform.claude.com "Models overview", developers.openai.com "Models" (one page per model),
/// and for the ChatGPT sign-in the model list in openai/codex. Where a provider caps what may
/// be sent below the window, the cap is the figure: the GPT-5 models with a 400,000 window
/// take 272,000, the other 128,000 being kept for the answer (openai.com, "Introducing GPT-5
/// for developers").
fn window(provider: Provider, model: &str) -> Option<u64> {
    // A name stands for its dated and suffixed forms: "gpt-5.2" for "gpt-5.2-2025-12-11".
    let named = |name: &str| {
        model
            .strip_prefix(name)
            .is_some_and(|rest| rest.is_empty() || rest.starts_with('-'))
    };
    let first = |table: &[(&str, u64)]| table.iter().find(|(n, _)| named(n)).map(|(_, size)| *size);
    match provider {
        Provider::Anthropic => first(&[
            ("claude-opus-4-5", 200_000),
            ("claude-opus-4-1", 200_000),
            ("claude-opus-4-0", 200_000),
            ("claude-sonnet-4-5", 200_000),
            ("claude-sonnet-4-0", 200_000),
            ("claude-haiku-4-5", 200_000),
        ])
        .or_else(|| {
            // The first Claude 4 names carry only a date: "claude-opus-4-20250514".
            let dated = ["claude-opus-4-2025", "claude-sonnet-4-2025"];
            let old = dated.iter().any(|d| model.starts_with(d)) || model.starts_with("claude-3");
            old.then_some(200_000)
        })
        .or_else(|| {
            let big = [
                "claude-fable-5-2",
                "claude-fable-5-1",
                "claude-fable-5",
                "claude-mythos-5-2",
                "claude-mythos-5-1",
                "claude-mythos-5",
                "claude-opus-5-5",
                "claude-opus-5",
                "claude-opus-4-8",
                "claude-opus-4-7",
                "claude-opus-4-6",
                "claude-sonnet-5-5",
                "claude-sonnet-5",
                "claude-sonnet-4-6",
                "claude-haiku-5-5",
            ];
            big.iter().any(|name| named(name)).then_some(1_000_000)
        }),
        Provider::OpenAi => {
            let small = model.contains("-mini") || model.contains("-nano");
            if model.starts_with("gpt-5") && model.contains("-chat") {
                return Some(128_000);
            }
            if small && (named("gpt-5.5") || named("gpt-5.6")) {
                return None;
            }
            if small && named("gpt-5.4") {
                return Some(272_000);
            }
            first(&[
                ("gpt-5.6", 1_050_000),
                ("gpt-5.5", 1_050_000),
                ("gpt-5.4", 1_050_000),
                ("gpt-5.3", 272_000),
                ("gpt-5.2", 272_000),
                ("gpt-5.1", 272_000),
                ("gpt-5", 272_000),
                ("gpt-4.1", 1_047_576),
                ("gpt-4o", 128_000),
                ("gpt-4-turbo", 128_000),
                ("o1-mini", 128_000),
                ("o1-preview", 128_000),
                ("o1", 200_000),
                ("o3", 200_000),
                ("o4-mini", 200_000),
                ("codex-mini", 200_000),
            ])
        }
        // What a ChatGPT sign-in is given is smaller than the same name on a key.
        Provider::ChatGpt => first(&[("gpt-5.6", 272_000), ("gpt-5.5", 272_000)]),
    }
}

/// Whether a conversation that last took `used` tokens should be compacted before going on.
pub fn near(limit: Option<u64>, used: u64) -> bool {
    limit.is_some_and(|limit| used as f64 >= limit as f64 * FULL)
}

/// Whether a provider's refusal says the conversation no longer fits.
pub fn overflowed(error: &AiError) -> bool {
    let AiError::Provider(message) = error else {
        return false;
    };
    let said = message.to_lowercase();
    [
        "prompt is too long",
        "context length",
        "context_length",
        "context window",
        "too many tokens",
        "maximum context",
    ]
    .iter()
    .any(|sign| said.contains(sign))
}

fn weight(messages: &[Value]) -> usize {
    messages.iter().map(|m| m.to_string().len()).sum()
}

fn is_result(message: &Value) -> bool {
    message["content"]
        .as_array()
        .is_some_and(|blocks| blocks.iter().any(|b| b["type"] == "tool_result"))
}

/// Where the part carried over word for word begins: the earliest message from which the rest
/// is small enough, never between a tool call and its result. 0 means there is nothing before
/// it to summarise. What is carried over is at most a tenth of the model's room.
pub fn split(messages: &[Value], limit: Option<u64>) -> usize {
    let keep = limit.map_or(KEEP_RECENT, |tokens| {
        KEEP_RECENT.min(tokens as usize * 4 / 10)
    });
    let starts: Vec<usize> = (1..messages.len())
        .filter(|&i| !is_result(&messages[i]))
        .collect();
    let fits = starts
        .iter()
        .copied()
        .find(|&i| weight(&messages[i..]) <= keep)
        .or(starts.last().copied())
        .unwrap_or(0);
    // A request still being worked on (the conversation ends with the person's message or a
    // tool's result) is never summarised away, however much its steps have read.
    if messages.last().is_some_and(|last| last["role"] == "user") {
        let asked = starts
            .iter()
            .copied()
            .rfind(|&i| messages[i]["role"] == "user");
        return fits.min(asked.unwrap_or(0));
    }
    fits
}

fn clip(text: &str, most: usize) -> String {
    if text.chars().count() <= most {
        return text.to_string();
    }
    let head: String = text.chars().take(most).collect();
    format!("{head}… [cut]")
}

/// The earlier messages as the summariser reads them: who said what, which tools ran and the
/// start of what each returned.
fn transcript(messages: &[Value], most: usize) -> String {
    let mut lines: Vec<String> = Vec::new();
    for message in messages {
        let who = if message["role"] == "assistant" {
            "Assistant"
        } else {
            "User"
        };
        if let Some(text) = message["content"].as_str() {
            lines.push(format!("{who}: {text}"));
            continue;
        }
        for block in message["content"].as_array().into_iter().flatten() {
            match block["type"].as_str() {
                Some("text") => lines.push(format!(
                    "{who}: {}",
                    block["text"].as_str().unwrap_or_default()
                )),
                Some("tool_use") => lines.push(format!(
                    "Assistant used {} with {}",
                    block["name"].as_str().unwrap_or_default(),
                    clip(&block["input"].to_string(), 400)
                )),
                Some("tool_result") => {
                    let text = match &block["content"] {
                        Value::String(text) => text.clone(),
                        other => other.to_string(),
                    };
                    lines.push(format!("Result: {}", clip(&text, RESULT_SHOWN)));
                }
                Some("attachment") => lines.push(format!(
                    "User attached the file {}",
                    block["path"].as_str().unwrap_or_default()
                )),
                Some("image") => lines.push("User attached a picture".into()),
                _ => {}
            }
        }
    }
    let all = lines.join("\n\n");
    let count = all.chars().count();
    if count <= most {
        return all;
    }
    // Too long even to summarise in one go: the start and the newest part say the most.
    let head: String = all.chars().take(most / 3).collect();
    let tail: String = all.chars().skip(count - most * 2 / 3).collect();
    format!("{head}\n\n[The middle of the conversation is left out here: it was too long to read at once.]\n\n{tail}")
}

/// The summary in a reply: what is between `<summary>` and `</summary>`; none when the reply
/// has no such block or the block is empty.
fn summary_in(reply: &str) -> Option<String> {
    let (_, rest) = reply.split_once("<summary>")?;
    let (inside, _) = rest.rsplit_once("</summary>")?;
    let inside = inside.trim();
    (!inside.is_empty()).then(|| inside.to_string())
}

/// What a compaction made.
#[derive(Debug, Clone, Serialize)]
pub struct Compacted {
    /// The conversation to carry on from: the summary, then the newest turns as they were.
    pub messages: Vec<Value>,
    pub summary: String,
    /// How many of the earlier messages the summary stands for.
    pub replaced: usize,
    /// How many of the person's own turns were carried over whole.
    pub kept_turns: usize,
    /// Tokens the summarising request read and wrote, when the provider says.
    pub input_tokens: u64,
    pub output_tokens: u64,
}

/// Ask the model to summarise the earlier part of `messages`, and return the conversation that
/// carries on from it. `note` is the person's own words on what to keep and what to drop.
/// `messages` is not changed: a failure leaves the conversation exactly as it was.
pub async fn compact(
    http: &provider::Client,
    config: &Config,
    key: &mut String,
    messages: &[Value],
    note: &str,
    core: Option<&Core>,
) -> Result<Compacted> {
    let at = split(messages, limit(config));
    if at == 0 {
        return Err(AiError::Provider("There is nothing to compact yet.".into()));
    }
    // Leave the summariser room to answer: about half the model's room, at four characters a token.
    let most = limit(config).map_or(TRANSCRIPT, |tokens| (tokens as usize) * 2);
    let mut asked = format!(
        "<conversation>\n{}\n</conversation>",
        // An attached file is read as the model was sent it, so a note can keep what is only in the file.
        transcript(
            &crate::files::expand(core, &messages[..at], &mut Default::default()),
            most
        )
    );
    if !note.trim().is_empty() {
        asked.push_str(&format!(
            "\n\n<note_from_user>\n{}\n</note_from_user>",
            note.trim()
        ));
    }
    asked.push_str("\n\nWrite the summary now, inside <summary> tags.");
    let turn = crate::chat::turn(
        http,
        config,
        key,
        SUMMARISER,
        &[],
        &[json!({ "role": "user", "content": asked })],
        &mut |_| {},
    )
    .await?;
    let reply: String = turn
        .content
        .iter()
        .filter(|b| b["type"] == "text")
        .filter_map(|b| b["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    let summary = summary_in(&reply).unwrap_or_default();
    // What stands in for the earlier messages has to be a summary of them. A model that
    // declined or apologised would have that answer kept as all that is known, so a summary is
    // told from any other reply by the tags it was asked to write it in, not by its length: a
    // note may fairly ask for one line. One that wrote more than it read leaves no more room.
    let unusable = if turn.stop == "refusal" {
        Some("The model declined to summarise this conversation")
    } else if summary.is_empty() {
        Some("The model wrote no summary")
    } else if summary.len() >= weight(&messages[..at])
        || near(limit(config), (summary.len() / 4) as u64)
    {
        Some("The model's summary was no shorter than what it would replace")
    } else {
        None
    };
    if let Some(why) = unusable {
        return Err(AiError::Provider(format!("{why}.")));
    }
    let told = json!({ "type": "text", "text": format!(
        "{SUMMARY_TAG}\nThe earlier part of this conversation was put away to make room. This is a summary of it; carry on from here.\n\n{summary}\n</conversation_summary>"
    ) });
    let mut out: Vec<Value> = Vec::new();
    let mut rest = messages[at..].iter();
    // The summary rides at the front of the first carried-over message when that one is the
    // user's, so the conversation still alternates.
    match messages.get(at) {
        Some(first) if first["role"] == "user" => {
            let mut content = vec![told];
            match &first["content"] {
                Value::String(text) => content.push(json!({ "type": "text", "text": text })),
                Value::Array(blocks) => content.extend(blocks.iter().cloned()),
                _ => {}
            }
            out.push(json!({ "role": "user", "content": content }));
            rest.next();
        }
        _ => out.push(json!({ "role": "user", "content": [told] })),
    }
    out.extend(rest.cloned());
    Ok(Compacted {
        messages: out,
        summary,
        replaced: at,
        kept_turns: messages[at..]
            .iter()
            .filter(|m| m["role"] == "user" && !is_result(m))
            .count(),
        input_tokens: turn.tokens.0,
        output_tokens: turn.tokens.1,
    })
}

/// The text between a pair of tags the app wraps attached notes and files in.
fn tagged(text: &str, tag: &str) -> usize {
    let (open, close) = (format!("<{tag}"), format!("</{tag}>"));
    let mut found = 0;
    let mut rest = text;
    while let Some(from) = rest.find(&open) {
        let Some(len) = rest[from..].find(&close) else {
            break;
        };
        found += len + close.len();
        rest = &rest[from + len + close.len()..];
    }
    found
}

/// What the conversation is made of, in characters by kind, so the person can see what is
/// taking the room: what was said, what tools returned, attached notes and files, a summary.
pub fn measure(messages: &[Value]) -> Value {
    let (mut said, mut tools, mut attached, mut summary) = (0usize, 0usize, 0usize, 0usize);
    let mut texts: Vec<&str> = Vec::new();
    for message in messages {
        if let Some(words) = message["content"].as_str() {
            texts.push(words);
            continue;
        }
        for block in message["content"].as_array().into_iter().flatten() {
            match block["type"].as_str() {
                Some("text") => texts.push(block["text"].as_str().unwrap_or_default()),
                Some("tool_use") | Some("tool_result") => tools += block.to_string().len(),
                // A picture is counted by the model in its own way; its bytes say nothing here.
                Some("image") | Some("attachment") => {}
                _ => said += block.to_string().len(),
            }
        }
    }
    for words in texts {
        if words.starts_with(SUMMARY_TAG) {
            summary += words.len();
            continue;
        }
        let files: usize = ["open_note", "note", "file"]
            .iter()
            .map(|tag| tagged(words, tag))
            .sum::<usize>()
            .min(words.len());
        attached += files;
        said += words.len() - files;
    }
    json!({ "messages": said, "tool_results": tools, "attached": attached, "summary": summary })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_window_is_the_published_one_for_that_exact_model() {
        // "claude" used to mean 200,000 and "gpt-5" 400,000 for every model so named.
        assert_eq!(
            window(Provider::Anthropic, "claude-opus-5-5"),
            Some(1_000_000)
        );
        assert_eq!(
            window(Provider::Anthropic, "claude-haiku-4-5-20251001"),
            Some(200_000)
        );
        assert_eq!(
            window(Provider::Anthropic, "claude-opus-4-20250514"),
            Some(200_000)
        );
        assert_eq!(
            window(Provider::Anthropic, "claude-opus-4-6"),
            Some(1_000_000)
        );
        // A Claude name the docs do not list is not assumed to be a large one.
        assert_eq!(window(Provider::Anthropic, "claude-opus-6"), None);
        assert_eq!(window(Provider::OpenAi, "o1-preview"), Some(128_000));
        assert_eq!(window(Provider::OpenAi, "o1-2024-12-17"), Some(200_000));
        assert_eq!(window(Provider::OpenAi, "gpt-5.5"), Some(1_050_000));
        // 400,000 in all, of which a conversation may fill 272,000: 80% of 400,000 never came.
        assert_eq!(window(Provider::OpenAi, "gpt-5.4-mini"), Some(272_000));
        assert_eq!(
            window(Provider::OpenAi, "gpt-5.2-chat-latest"),
            Some(128_000)
        );
        assert_eq!(window(Provider::OpenAi, "gpt-5-mini"), Some(272_000));
        assert_eq!(window(Provider::OpenAi, "gpt-5.7"), None);
        assert_eq!(window(Provider::ChatGpt, "gpt-5.5"), Some(272_000));
        assert_eq!(window(Provider::ChatGpt, "gpt-5.2"), None);
    }

    /// "Sorry, I am not able to produce a summary" was once kept as the summary, and a
    /// one-line summary the person had asked for was once refused as too short.
    #[test]
    fn a_summary_is_what_is_inside_the_tags_however_short() {
        assert_eq!(
            summary_in("Here it is.\n<summary>\n- Team: $18\n</summary>\nDone.").as_deref(),
            Some("- Team: $18")
        );
        assert_eq!(
            summary_in("Sorry, I am not able to produce a summary."),
            None
        );
        assert_eq!(summary_in("<summary>  </summary>"), None);
        assert_eq!(summary_in("<summary>cut off"), None);
    }

    /// The carried-over part never starts with a tool's result, whose call would be gone.
    #[test]
    fn the_cut_never_parts_a_tool_call_from_its_result() {
        let big = "x".repeat(KEEP_RECENT);
        let messages = vec![
            json!({ "role": "user", "content": big }),
            json!({ "role": "assistant", "content": [{ "type": "tool_use", "id": "1", "name": "read_note", "input": {} }] }),
            json!({ "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "1", "content": "short" }] }),
        ];
        // The only request there is stays whole.
        assert_eq!(split(&messages, None), 0);
        let messages = [
            messages,
            vec![json!({ "role": "user", "content": "and then?" })],
        ]
        .concat();
        assert_eq!(split(&messages, None), 1);
        assert_eq!(split(&messages[..1], None), 0);
        // Answered, the one request can be summarised and its answer carried over.
        assert_eq!(split(&messages[..2], None), 1);
    }
}
