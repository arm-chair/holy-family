import {
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Heart,
  LoaderCircle,
  Music2,
  RefreshCw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { choiceSets, youtubeSearchUrl } from "./data/planningContent";
import type { ChoiceOption, ChoiceSet, Rating } from "./data/types";
import {
  loadVoteConfig,
  loadVoteResults,
  submitVote,
  type VoteResults,
} from "./votes";

type RatingsBySet = Record<string, Record<string, Rating | undefined>>;
type FinalsBySet = Record<string, string | undefined>;
type VoteConfigStatus = "loading" | "ready" | "missing" | "error";
type VoteLoadStatus = "idle" | "loading" | "ready" | "error";
type VoteSubmitStatus = "idle" | "submitting" | "submitted" | "error";

const STORAGE_KEY = "holy-family-funeral-planner";

interface PlannerState {
  ratings: RatingsBySet;
  finals: FinalsBySet;
}

const defaultState: PlannerState = {
  ratings: {},
  finals: {},
};

const loadPlannerState = (): PlannerState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
  } catch {
    return defaultState;
  }
};

const savePlannerState = (state: PlannerState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const getRating = (
  ratings: RatingsBySet,
  setId: string,
  optionId: string,
) => ratings[setId]?.[optionId];

const getOption = (set: ChoiceSet, optionId?: string) =>
  set.options.find((option) => option.id === optionId);

const getLikedOptions = (set: ChoiceSet, ratings: RatingsBySet) =>
  set.options.filter((option) => getRating(ratings, set.id, option.id) === "up");

const isFinalChoiceValid = (
  set: ChoiceSet,
  ratings: RatingsBySet,
  finals: FinalsBySet,
) => {
  const finalId = finals[set.id];
  return Boolean(finalId && getRating(ratings, set.id, finalId) === "up");
};

const makeSummaryText = (finals: FinalsBySet, ratings: RatingsBySet) => {
  const lines = [
    "Holy Family Funeral Mass Planning",
    `Prepared: ${new Date().toLocaleDateString()}`,
    "",
  ];

  for (const set of choiceSets) {
    if (!isFinalChoiceValid(set, ratings, finals)) continue;

    const option = getOption(set, finals[set.id]);
    if (!option) continue;

    lines.push(`${set.title}: ${option.title}`);
    if (option.citation) lines.push(`Reading: ${option.citation}`);
    if (option.kind === "hymn" || option.kind === "psalm") {
      lines.push(
        `YouTube search: ${youtubeSearchUrl(option.searchTerms ?? option.title)}`,
      );
    }
    if (option.note) lines.push(`Note: ${option.note}`);
    lines.push("");
  }

  lines.push(
    "Scripture text source: World English Bible Catholic edition, public domain.",
  );

  return lines.join("\n");
};

const getFinalChoices = (finals: FinalsBySet, ratings: RatingsBySet) =>
  Object.fromEntries(
    choiceSets.flatMap((set) => {
      if (!isFinalChoiceValid(set, ratings, finals)) return [];
      return [[set.id, finals[set.id] as string]];
    }),
  );

const autoSelectSingleLikedChoices = (state: PlannerState): PlannerState => {
  let changed = false;
  const nextFinals = { ...state.finals };

  for (const set of choiceSets) {
    if (isFinalChoiceValid(set, state.ratings, nextFinals)) continue;

    const likedOptions = getLikedOptions(set, state.ratings);
    if (likedOptions.length === 1) {
      nextFinals[set.id] = likedOptions[0].id;
      changed = true;
    }
  }

  return changed ? { ...state, finals: nextFinals } : state;
};

const optionIcon = (kind: ChoiceOption["kind"]) => {
  if (kind === "reading") return <BookOpen aria-hidden="true" />;
  if (kind === "psalm") return <Music2 aria-hidden="true" />;
  if (kind === "hymn") return <Music2 aria-hidden="true" />;
  return <Heart aria-hidden="true" />;
};

const youtubeEmbedUrl = (videoId: string) =>
  `https://www.youtube.com/embed/${videoId}`;

function App() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [plannerState, setPlannerState] = useState(loadPlannerState);
  const [copyStatus, setCopyStatus] = useState("");
  const [voteEndpoint, setVoteEndpoint] = useState("");
  const [voteConfigStatus, setVoteConfigStatus] =
    useState<VoteConfigStatus>("loading");
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [voteLoadStatus, setVoteLoadStatus] =
    useState<VoteLoadStatus>("idle");
  const [voteSubmitStatus, setVoteSubmitStatus] =
    useState<VoteSubmitStatus>("idle");
  const [voteMessage, setVoteMessage] = useState("");

  const activeSet = choiceSets[activeIndex];
  const isSummary = activeIndex === choiceSets.length;
  const isVotes = activeIndex === choiceSets.length + 1;
  const completedCount = choiceSets.filter(
    (set) => isFinalChoiceValid(set, plannerState.ratings, plannerState.finals),
  ).length;
  const missingSets = choiceSets.filter(
    (set) => !isFinalChoiceValid(set, plannerState.ratings, plannerState.finals),
  );

  const refreshVotes = useCallback(async () => {
    if (!voteEndpoint) return;

    setVoteLoadStatus("loading");
    try {
      const results = await loadVoteResults(voteEndpoint);
      setVoteResults(results);
      setVoteLoadStatus("ready");
      setVoteMessage("");
    } catch (error) {
      setVoteLoadStatus("error");
      setVoteMessage(
        error instanceof Error ? error.message : "Vote results could not be loaded.",
      );
    }
  }, [voteEndpoint]);

  useEffect(() => {
    let ignore = false;

    const loadConfig = async () => {
      try {
        const config = await loadVoteConfig();
        if (ignore) return;

        setVoteEndpoint(config.endpoint);
        setVoteConfigStatus(config.endpoint ? "ready" : "missing");
      } catch {
        if (ignore) return;
        setVoteConfigStatus("error");
        setVoteMessage("Vote backend config could not be loaded.");
      }
    };

    void loadConfig();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (voteConfigStatus !== "ready") return;
    void refreshVotes();
  }, [refreshVotes, voteConfigStatus]);

  const updateState = (
    next: PlannerState | ((current: PlannerState) => PlannerState),
  ) => {
    setPlannerState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      savePlannerState(resolved);
      return resolved;
    });
  };

  const setRating = (setId: string, optionId: string, rating: Rating) => {
    updateState((currentState) => {
      const current = currentState.ratings[setId]?.[optionId];
      const nextRating = current === rating ? undefined : rating;
      const nextSetRatings = {
        ...(currentState.ratings[setId] ?? {}),
        [optionId]: nextRating,
      };
      const nextFinals = { ...currentState.finals };

      if (nextRating !== "up" && nextFinals[setId] === optionId) {
        nextFinals[setId] = undefined;
      }

      return {
        ratings: {
          ...currentState.ratings,
          [setId]: nextSetRatings,
        },
        finals: nextFinals,
      };
    });
  };

  const setFinal = (setId: string, optionId: string) => {
    updateState((currentState) => ({
      ratings: currentState.ratings,
      finals: {
        ...currentState.finals,
        [setId]: optionId,
      },
    }));
  };

  const goToStep = (index: number) => {
    setActiveIndex(index);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const showSummary = () => {
    updateState(autoSelectSingleLikedChoices);
    goToStep(choiceSets.length);
  };

  const resetAll = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setPlannerState(defaultState);
    goToStep(0);
    setCopyStatus("");
  };

  const copySummary = async () => {
    const text = makeSummaryText(plannerState.finals, plannerState.ratings);
    try {
      await window.navigator.clipboard.writeText(text);
      setCopyStatus("Copied");
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "true");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
      setCopyStatus("Copied");
    }
    window.setTimeout(() => setCopyStatus(""), 1800);
  };

  const submitFinalVotes = async () => {
    if (!voteEndpoint || missingSets.length) return;

    setVoteSubmitStatus("submitting");
    setVoteMessage("");

    try {
      await submitVote(
        voteEndpoint,
        getFinalChoices(plannerState.finals, plannerState.ratings),
      );
      setVoteSubmitStatus("submitted");
      setVoteLoadStatus("loading");
      setVoteMessage("Submitted. Loading the latest votes.");
      goToStep(choiceSets.length + 1);
      window.setTimeout(() => setVoteSubmitStatus("idle"), 2500);
      window.setTimeout(() => {
        void refreshVotes();
      }, 1200);
    } catch (error) {
      setVoteSubmitStatus("error");
      setVoteMessage(
        error instanceof Error ? error.message : "Votes could not be submitted.",
      );
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Holy Family Catholic Church</p>
          <h1>Funeral Mass Planning</h1>
        </div>
        <div className="topbar-actions">
          <span className="progress-pill">
            {completedCount}/{choiceSets.length} final
          </span>
          <button className="icon-button" onClick={resetAll} title="Clear saved choices">
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="planner-layout">
        <aside className="step-list" aria-label="Planning sections">
          {choiceSets.map((set, index) => {
            const isActive = activeIndex === index;
            const isComplete = isFinalChoiceValid(
              set,
              plannerState.ratings,
              plannerState.finals,
            );
            return (
              <button
                className={`step-button ${isActive ? "active" : ""}`}
                key={set.id}
                onClick={() => goToStep(index)}
              >
                <span className="step-status">
                  {isComplete ? <Check aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  <strong>{set.title}</strong>
                  <small>{set.section}</small>
                </span>
              </button>
            );
          })}

          <button
            className={`step-button summary ${isSummary ? "active" : ""}`}
            onClick={showSummary}
          >
            <span className="step-status">{choiceSets.length + 1}</span>
            <span>
              <strong>Summary</strong>
              <small>Final choices</small>
            </span>
          </button>

          <button
            className={`step-button summary ${isVotes ? "active" : ""}`}
            onClick={() => {
              goToStep(choiceSets.length + 1);
              void refreshVotes();
            }}
          >
            <span className="step-status">{choiceSets.length + 2}</span>
            <span>
              <strong>Votes</strong>
              <small>Submitted results</small>
            </span>
          </button>
        </aside>

        {isSummary ? (
          <SummaryView
            finals={plannerState.finals}
            ratings={plannerState.ratings}
            missingSets={missingSets}
            onFinalChange={setFinal}
            onCopy={copySummary}
            onShowVotes={() => {
              goToStep(choiceSets.length + 1);
              void refreshVotes();
            }}
            onSubmitVotes={submitFinalVotes}
            copyStatus={copyStatus}
            voteConfigStatus={voteConfigStatus}
            voteSubmitStatus={voteSubmitStatus}
          />
        ) : isVotes ? (
          <VotesView
            results={voteResults}
            status={voteLoadStatus}
            configStatus={voteConfigStatus}
            message={voteMessage}
            onRefresh={refreshVotes}
          />
        ) : (
          <section className="choice-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{activeSet.section}</p>
                <h2>{activeSet.title}</h2>
                {activeSet.description ? (
                  <p className="panel-description">{activeSet.description}</p>
                ) : null}
              </div>
            </div>

            <div className="option-grid">
              {activeSet.options.map((option) => (
                <OptionCard
                  key={option.id}
                  option={option}
                  set={activeSet}
                  rating={getRating(
                    plannerState.ratings,
                    activeSet.id,
                    option.id,
                  )}
                  onRate={setRating}
                />
              ))}
            </div>

            <div className="panel-actions">
              <button
                className="secondary-button"
                disabled={activeIndex === 0}
                onClick={() => goToStep(Math.max(0, activeIndex - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  if (activeIndex === choiceSets.length - 1) {
                    showSummary();
                    return;
                  }

                  goToStep(activeIndex + 1);
                }}
              >
                {activeIndex === choiceSets.length - 1 ? "Summary" : "Next"}
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

interface OptionCardProps {
  option: ChoiceOption;
  set: ChoiceSet;
  rating?: Rating;
  onRate: (setId: string, optionId: string, rating: Rating) => void;
}

function OptionCard({
  option,
  set,
  rating,
  onRate,
}: OptionCardProps) {
  const isRejected = rating === "down";
  const searchTerms = option.searchTerms ?? option.title;

  return (
    <article className={`option-card ${isRejected ? "rejected" : ""}`}>
      <div className="option-title-row">
        <span className="option-kind-icon">{optionIcon(option.kind)}</span>
        <div>
          <h3>{option.title}</h3>
          {option.citation ? <p>{option.citation}</p> : null}
        </div>
      </div>

      {option.note ? <p className="option-note">{option.note}</p> : null}

      {option.reading ? (
        <details className="reading-preview">
          <summary>Reading text</summary>
          <div className="reading-text">
            {option.reading.text.split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>
      ) : null}

      {option.kind === "hymn" || option.kind === "psalm" ? (
        <>
          {option.youtubeVideoId ? (
            <div className="youtube-embed">
              <iframe
                src={youtubeEmbedUrl(option.youtubeVideoId)}
                title={`YouTube preview for ${option.title}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : null}
          <a
            className="youtube-link"
            href={youtubeSearchUrl(searchTerms)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden="true" />
            YouTube
          </a>
        </>
      ) : null}

      <div className="rating-row">
        <button
          className={`rating-button ${rating === "up" ? "selected" : ""}`}
          onClick={() => onRate(set.id, option.id, "up")}
          title="Thumbs up"
        >
          <ThumbsUp aria-hidden="true" />
        </button>
        <button
          className={`rating-button ${rating === "down" ? "selected down" : ""}`}
          onClick={() => onRate(set.id, option.id, "down")}
          title="Thumbs down"
        >
          <ThumbsDown aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

interface SummaryViewProps {
  finals: FinalsBySet;
  ratings: RatingsBySet;
  missingSets: ChoiceSet[];
  onFinalChange: (setId: string, optionId: string) => void;
  onCopy: () => Promise<void>;
  onShowVotes: () => void;
  onSubmitVotes: () => Promise<void>;
  copyStatus: string;
  voteConfigStatus: VoteConfigStatus;
  voteSubmitStatus: VoteSubmitStatus;
}

function SummaryView({
  finals,
  ratings,
  missingSets,
  onFinalChange,
  onCopy,
  onShowVotes,
  onSubmitVotes,
  copyStatus,
  voteConfigStatus,
  voteSubmitStatus,
}: SummaryViewProps) {
  const canCopy = missingSets.length === 0;
  const canSubmit = canCopy && voteConfigStatus === "ready";
  const submitLabel =
    voteSubmitStatus === "submitting"
      ? "Submitting"
      : voteSubmitStatus === "submitted"
        ? "Submitted"
        : "Submit";

  return (
    <section className="summary-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Final Commendation</p>
          <h2>Summary</h2>
        </div>
        <div className="summary-actions">
          <button
            className="secondary-button"
            onClick={onShowVotes}
          >
            <BarChart3 aria-hidden="true" />
            Votes
          </button>
          <button
            className="primary-button"
            onClick={() => {
              void onSubmitVotes();
            }}
            disabled={!canSubmit || voteSubmitStatus === "submitting"}
            aria-busy={voteSubmitStatus === "submitting"}
            title={
              canSubmit
                ? "Submit final choices"
                : voteConfigStatus === "ready"
                  ? "Choose one final option for every set"
                  : "Vote submission is not configured yet"
            }
          >
            {voteSubmitStatus === "submitting" ? (
              <LoaderCircle className="spinner-icon" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {submitLabel}
          </button>
          <button
            className="secondary-button"
            onClick={onCopy}
            disabled={!canCopy}
            title={canCopy ? "Copy final choices" : "Choose one final option for every set"}
          >
            <ClipboardCopy aria-hidden="true" />
            {copyStatus || "Copy"}
          </button>
        </div>
      </div>

      {voteConfigStatus === "missing" ? (
        <div className="missing-banner">
          Vote submission is not configured yet. Add the Apps Script web-app URL
          to <strong>public/votes-config.json</strong>.
        </div>
      ) : null}

      {voteConfigStatus === "loading" ? (
        <div className="loading-banner" role="status">
          <LoaderCircle className="spinner-icon" aria-hidden="true" />
          Connecting to the vote sheet.
        </div>
      ) : null}

      {missingSets.length ? (
        <div className="missing-banner">
          <strong>Missing final choices:</strong>{" "}
          {missingSets.map((set) => set.title).join(", ")}
        </div>
      ) : null}

      <div className="summary-list">
        {choiceSets.map((set) => {
          const finalOption = isFinalChoiceValid(set, ratings, finals)
            ? getOption(set, finals[set.id])
            : undefined;
          const likedOptions = getLikedOptions(set, ratings);

          return (
            <article className="summary-item" key={set.id}>
              <div className="summary-heading">
                <div>
                  <p className="eyebrow">{set.section}</p>
                  <h3>{set.title}</h3>
                </div>
                {finalOption ? (
                  <span className="final-chip">{finalOption.title}</span>
                ) : null}
              </div>

              <div className="summary-options">
                {likedOptions.length ? (
                  likedOptions.map((option) => {
                    const selected = finals[set.id] === option.id;

                    return (
                      <label
                        className={`summary-choice ${selected ? "selected" : ""}`}
                        key={option.id}
                      >
                        <input
                          type="radio"
                          name={set.id}
                          checked={selected}
                          onChange={() => onFinalChange(set.id, option.id)}
                        />
                        <span>
                          <strong>{option.title}</strong>
                          {option.citation ? (
                            <small>{option.citation}</small>
                          ) : null}
                        </span>
                        <ThumbsUp
                          className="summary-rating"
                          aria-hidden="true"
                        />
                      </label>
                    );
                  })
                ) : (
                  <p className="summary-empty">No thumbs-up choices yet.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

interface VotesViewProps {
  results: VoteResults | null;
  status: VoteLoadStatus;
  configStatus: VoteConfigStatus;
  message: string;
  onRefresh: () => Promise<void>;
}

function VotesView({
  results,
  status,
  configStatus,
  message,
  onRefresh,
}: VotesViewProps) {
  const totalSubmissions = results?.totalSubmissions ?? 0;

  return (
    <section className="summary-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Family selections</p>
          <h2>Submitted Votes</h2>
          <p className="panel-description">
            {totalSubmissions} submitted {totalSubmissions === 1 ? "vote" : "votes"}
            {results?.updatedAt ? `, updated ${formatUpdatedAt(results.updatedAt)}` : ""}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            void onRefresh();
          }}
          disabled={configStatus !== "ready" || status === "loading"}
          aria-busy={status === "loading"}
        >
          {status === "loading" ? (
            <LoaderCircle className="spinner-icon" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {status === "loading" ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {configStatus === "loading" ? (
        <div className="loading-banner" role="status">
          <LoaderCircle className="spinner-icon" aria-hidden="true" />
          Connecting to the vote sheet.
        </div>
      ) : null}

      {configStatus === "missing" ? (
        <div className="missing-banner">
          Vote results are not configured yet. Add the Apps Script web-app URL to{" "}
          <strong>public/votes-config.json</strong>.
        </div>
      ) : null}

      {configStatus === "error" || status === "error" ? (
        <div className="missing-banner">
          {message || "Vote results could not be loaded."}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="loading-banner" role="status">
          <LoaderCircle className="spinner-icon" aria-hidden="true" />
          {message || "Loading submitted votes."}
        </div>
      ) : null}

      <div className="summary-list">
        {choiceSets.map((set) => {
          const setCounts = results?.counts[set.id] ?? {};
          const votedOptions = set.options
            .map((option) => ({
              option,
              count: setCounts[option.id] ?? 0,
            }))
            .filter(({ count }) => count > 0)
            .sort(
              (a, b) =>
                b.count - a.count || a.option.title.localeCompare(b.option.title),
            );
          const setTotal = votedOptions.reduce(
            (sum, item) => sum + item.count,
            0,
          );

          return (
            <article className="summary-item" key={set.id}>
              <div className="summary-heading">
                <div>
                  <p className="eyebrow">{set.section}</p>
                  <h3>{set.title}</h3>
                </div>
                <span className="final-chip">
                  {setTotal} {setTotal === 1 ? "vote" : "votes"}
                </span>
              </div>

              <div className="vote-options">
                {votedOptions.length ? (
                  votedOptions.map(({ option, count }) => {
                    const percent = setTotal ? Math.round((count / setTotal) * 100) : 0;

                    return (
                      <div className="vote-row" key={option.id}>
                        <div className="vote-row-text">
                          <strong>{option.title}</strong>
                          {option.citation ? <small>{option.citation}</small> : null}
                        </div>
                        <div className="vote-meter" aria-hidden="true">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <span className="vote-count">
                          {count} ({percent}%)
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="summary-empty">No submitted votes yet.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default App;
