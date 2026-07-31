/**
 * General preferences.
 *
 * Props:
 *   advancedFeatures            {boolean}    whether the advanced panels are on
 *                                            → Preferences.jsx `advancedFeatures`
 *   onAdvancedFeaturesChange    (next:bool)  set it
 *                                            → Preferences.jsx `setAdvancedFeatures`
 */
import * as P from "../primitives.jsx";

export default function General({ advancedFeatures, onAdvancedFeaturesChange }) {
  return (
    <P.Page
      title="General"
      lede="Lokus opens as an editor, a file tree and search. Everything else is opt-in."
    >
      <P.Group label="Features">
        <P.Row
          label="Advanced features"
          hint="Adds Graph, Canvas, Kanban, Bases, Calendar, Sync, Plugins, Templates, Terminal and Version History."
        >
          <P.Toggle
            checked={advancedFeatures}
            onChange={onAdvancedFeaturesChange}
            label="Advanced features"
          />
        </P.Row>
      </P.Group>
    </P.Page>
  );
}
