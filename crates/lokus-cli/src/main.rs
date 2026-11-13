//! @part-of cli
//! `lokus <command> [--vault DIR] [key=value ...] [--json '{...}']`
//! `lokus app <command> [key=value ...]`   run inside the running dev app
//!
//! Output is JSON on stdout; errors are JSON on stderr with exit code 1.

use std::io::{BufRead, BufReader, Write};
use std::process::ExitCode;

use lokus_core::error::ErrorBody;
use lokus_core::{commands, Core};
use serde_json::{json, Map, Value};

const USAGE: &str = "usage:
  lokus <command> [--vault DIR] [key=value ...] [--json '{...}']
  lokus app <command> [key=value ...]     (talks to the running dev app)
  lokus commands.list                     (every core command)

The vault defaults to $LOKUS_VAULT, then the current directory.
Values are parsed as JSON when possible, otherwise taken as text.";

fn main() -> ExitCode {
    let mut argv: Vec<String> = std::env::args().skip(1).collect();
    if argv.is_empty() || argv[0] == "--help" || argv[0] == "-h" {
        println!("{USAGE}");
        return ExitCode::SUCCESS;
    }
    let in_app = argv[0] == "app";
    if in_app {
        argv.remove(0);
    }
    let parsed = match parse(argv) {
        Ok(p) => p,
        Err(message) => return fail(json!({ "code": "usage", "message": message })),
    };

    let result = if in_app {
        run_in_app(&parsed)
    } else {
        run_on_vault(&parsed)
    };
    match result {
        Ok(value) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&value).unwrap_or_default()
            );
            let failed_check = parsed.command == "vault.fidelity"
                && value["mismatches"]
                    .as_array()
                    .is_some_and(|m| !m.is_empty());
            if failed_check {
                ExitCode::FAILURE
            } else {
                ExitCode::SUCCESS
            }
        }
        Err(body) => fail(body),
    }
}

struct Parsed {
    command: String,
    vault: Option<String>,
    args: Value,
}

fn parse(argv: Vec<String>) -> Result<Parsed, String> {
    let mut it = argv.into_iter();
    let command = it.next().ok_or("missing command")?;
    let mut vault = None;
    let mut args = Map::new();
    while let Some(arg) = it.next() {
        if arg == "--vault" {
            vault = Some(it.next().ok_or("--vault needs a directory")?);
        } else if arg == "--json" {
            let raw = it.next().ok_or("--json needs a value")?;
            match serde_json::from_str::<Value>(&raw) {
                Ok(Value::Object(obj)) => args.extend(obj),
                _ => return Err("--json must be a JSON object".into()),
            }
        } else if let Some((key, value)) = arg.split_once('=') {
            let value =
                serde_json::from_str(value).unwrap_or_else(|_| Value::String(value.to_string()));
            args.insert(key.to_string(), value);
        } else {
            return Err(format!("unexpected argument: {arg}"));
        }
    }
    Ok(Parsed {
        command,
        vault,
        args: Value::Object(args),
    })
}

fn run_on_vault(p: &Parsed) -> Result<Value, Value> {
    let root = p
        .vault
        .clone()
        .or_else(|| std::env::var("LOKUS_VAULT").ok())
        .unwrap_or_else(|| ".".to_string());
    let core = Core::open(&root).map_err(|e| error_json(&e))?;
    // A terminal run has no watcher, so catch up with the files first.
    if [
        "search.query",
        "links.backlinks",
        "links.outgoing",
        "graph.data",
        "tags.list",
    ]
    .contains(&p.command.as_str())
    {
        core.index()
            .and_then(|mut i| i.refresh())
            .map_err(|e| error_json(&e))?;
    }
    commands::run(&core, &p.command, p.args.clone()).map_err(|e| error_json(&e))
}

/// The dev build of the desktop app listens on a unix socket and runs any
/// command, core or UI, inside the live app.
#[cfg(unix)]
fn run_in_app(p: &Parsed) -> Result<Value, Value> {
    use std::os::unix::net::UnixStream;
    let path = std::env::temp_dir().join("lokus-dev.sock");
    let io = |e: std::io::Error| json!({ "code": "app_unreachable", "message": format!("{} ({e}); is `pnpm dev` running?", path.display()) });
    let mut stream = UnixStream::connect(&path).map_err(io)?;
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(20)))
        .map_err(io)?;
    let request = json!({ "name": p.command, "args": p.args });
    writeln!(stream, "{request}").map_err(io)?;
    let mut line = String::new();
    BufReader::new(stream).read_line(&mut line).map_err(io)?;
    let reply: Value = serde_json::from_str(&line)
        .map_err(|e| json!({ "code": "bad_reply", "message": e.to_string() }))?;
    if reply["ok"] == true {
        Ok(reply["value"].clone())
    } else {
        Err(reply["error"].clone())
    }
}

#[cfg(not(unix))]
fn run_in_app(_p: &Parsed) -> Result<Value, Value> {
    Err(json!({ "code": "unsupported", "message": "`lokus app` needs macOS or Linux for now" }))
}

fn error_json(e: &lokus_core::CoreError) -> Value {
    serde_json::to_value(ErrorBody::from(e)).unwrap_or(Value::Null)
}

fn fail(body: Value) -> ExitCode {
    eprintln!(
        "{}",
        serde_json::to_string_pretty(&body).unwrap_or_default()
    );
    ExitCode::FAILURE
}
