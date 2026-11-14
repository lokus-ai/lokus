/** @part-of ui.customers */
import { useEffect, useMemo, useState } from "react";

import { Icon } from "../../shell/Icon";
import { Conversation } from "./CustomerProfile";
import { HIDDEN, isOpenIssue, type Item, kindOf, label, loadPersonItems, type Schema, threads } from "./data";
import { Field, ItemRow, KIND_ICON_OF, Value } from "./parts";

interface Props {
  /** The person's note. Which customer they belong to is its `customer` property. */
  path: string;
  properties: Record<string, string>;
  version: number;
  onProperty(key: string, value: string | null): void;
  onOpen(path: string): void;
}

const NO_SCHEMA: Schema = { path: null, kinds: {}, hidden: [], columns: [] };
/** How a person is known in each place messages come from. Shown first, since matching depends on them. */
const IDENTITIES = ["email", "slack", "phone"];

/**
 * One person at a customer, between their note's title and its text: who they are, how each
 * tool knows them, what they have asked for and every conversation they took part in.
 */
export default function PersonProfile({ path, properties, version, onProperty, onOpen }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [customer, setCustomer] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const name = path.split("/").pop()!.replace(/\.md$/i, "");

  useEffect(() => {
    let current = true;
    void loadPersonItems(name, properties)
      .then((found) => {
        if (!current) return;
        setItems(found.items);
        setCustomer(found.customer);
      })
      .catch(() => current && setItems([]));
    return () => {
      current = false;
    };
    // The identities decide what counts as theirs, so a change to one reloads.
  }, [name, version, properties.customer, properties.email, properties.slack, properties.also]);

  const asks = useMemo(() => items.filter(isOpenIssue), [items]);
  const talks = useMemo(() => threads(items), [items]);
  const rest = items.filter((i) => i.kind !== "message" && !isOpenIssue(i));
  const set = (key: string) => (next: string) => onProperty(key, next.trim() || null);
  const keys = Object.keys(properties).filter((k) => !HIDDEN.has(k) && k !== "customer");
  const details = [...IDENTITIES.filter((k) => keys.includes(k)), ...keys.filter((k) => !IDENTITIES.includes(k))];

  return (
    <div className="cust">
      <div className="cust-props">
        <div className="cust-detail">
          <span className="cust-detail-name">
            <Icon name="customers" size={14} />
            Customer
          </span>
          {customer ? (
            <button className="cust-value" onClick={() => onOpen(customer)}>
              <span className="cust-chip">{properties.customer}</span>
            </button>
          ) : (
            <Field label="customer" value={properties.customer ?? ""} onChange={set("customer")} />
          )}
        </div>
        {details.map((key) => (
          <div key={key} className="cust-detail">
            <span className="cust-detail-name">
              <Icon name={KIND_ICON_OF[kindOf(NO_SCHEMA, key, properties[key])]} size={14} />
              {label(key)}
            </span>
            <Field label={key} value={properties[key]} onChange={set(key)}>
              <Value kind={kindOf(NO_SCHEMA, key, properties[key])} value={properties[key]} />
            </Field>
          </div>
        ))}
        <div className="cust-props-foot">
          {adding ? (
            <input
              className="cust-input"
              autoFocus
              aria-label="New detail"
              placeholder="Name of the detail"
              onBlur={(e) => {
                const key = e.target.value.trim().toLowerCase().replace(/\s+/g, "_");
                setAdding(false);
                if (key && !(key in properties)) onProperty(key, "-");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setAdding(false);
              }}
            />
          ) : (
            <button className="cust-add" onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} />
              Add a detail
            </button>
          )}
        </div>
      </div>

      <section>
        <h3>
          Asked for <span>{asks.length}</span>
        </h3>
        {asks.length === 0 ? <p className="cust-empty">Nothing they asked for is open.</p> : asks.map((item) => <ItemRow key={item.path} item={item} onOpen={onOpen} />)}
      </section>

      <section>
        <h3>
          Conversations <span>{talks.length}</span>
        </h3>
        {talks.length === 0 ? (
          <p className="cust-empty">No messages from {name} yet. Messages are matched by name, email or Slack name.</p>
        ) : (
          talks.map((t) => <Conversation key={t.id} thread={t} onOpen={onOpen} />)
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <h3>
            Earlier <span>{rest.length}</span>
          </h3>
          {rest.map((item) => (
            <ItemRow key={item.path} item={item} onOpen={onOpen} />
          ))}
        </section>
      )}

      <h3 className="cust-notes">Notes</h3>
    </div>
  );
}
