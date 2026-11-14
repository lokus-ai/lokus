//! @part-of sync
//! The relay's HTTP side: workspaces, members and invites.

use serde_json::Value;

use crate::error::{Error, Result};

/// One request to the relay. `path` starts with `/v1/`.
pub async fn call(
    server: &str,
    token: &str,
    method: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value> {
    if !path.starts_with("/v1/") {
        return Err(Error::Net("not a relay path".into()));
    }
    let url = format!("{}{}", server.trim_end_matches('/'), path);
    let client = reqwest::Client::new();
    let request = match method {
        "GET" => client.get(url),
        "POST" => client.post(url).json(&body.unwrap_or(Value::Null)),
        "PATCH" => client.patch(url).json(&body.unwrap_or(Value::Null)),
        "DELETE" => client.delete(url),
        other => return Err(Error::Net(format!("unsupported method {other}"))),
    };
    let response = request
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| Error::Net(e.to_string()))?;
    let status = response.status();
    let value: Value = response.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        Ok(value)
    } else {
        Err(Error::Refused(
            value["message"]
                .as_str()
                .unwrap_or("the relay refused the request")
                .to_string(),
        ))
    }
}
