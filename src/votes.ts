const CONFIG_URL = `${import.meta.env.BASE_URL}votes-config.json`;

export interface VoteConfig {
  endpoint: string;
}

export interface VoteResults {
  totalSubmissions: number;
  updatedAt?: string;
  counts: Record<string, Record<string, number>>;
}

interface VotePayload {
  submittedAt: string;
  submissionId: string;
  choices: Record<string, string>;
}

const makeSubmissionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const loadVoteConfig = async (): Promise<VoteConfig> => {
  const response = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!response.ok) return { endpoint: "" };

  const data = (await response.json()) as Partial<VoteConfig>;
  return { endpoint: typeof data.endpoint === "string" ? data.endpoint.trim() : "" };
};

export const submitVote = async (
  endpoint: string,
  choices: Record<string, string>,
) => {
  const payload: VotePayload = {
    submittedAt: new Date().toISOString(),
    submissionId: makeSubmissionId(),
    choices,
  };
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });

  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    body: blob,
  });
};

export const loadVoteResults = (endpoint: string): Promise<VoteResults> =>
  new Promise((resolve, reject) => {
    const callbackName = `__holyFamilyVotes_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const callbacks = window as unknown as Window &
      Record<string, (payload: unknown) => void>;
    const script = document.createElement("script");
    const url = new URL(endpoint);

    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", Date.now().toString());

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete callbacks[callbackName];
      script.remove();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Vote results took too long to load. Try Refresh."));
    }, 60000);

    callbacks[callbackName] = (payload: unknown) => {
      cleanup();
      resolve(normalizeVoteResults(payload));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Vote results could not be loaded."));
    };

    script.src = url.toString();
    document.head.appendChild(script);
  });

const normalizeVoteResults = (payload: unknown): VoteResults => {
  if (!payload || typeof payload !== "object") {
    return { totalSubmissions: 0, counts: {} };
  }

  const value = payload as Partial<VoteResults>;
  const counts: Record<string, Record<string, number>> = {};

  if (value.counts && typeof value.counts === "object") {
    for (const [setId, setCounts] of Object.entries(value.counts)) {
      if (!setCounts || typeof setCounts !== "object") continue;

      counts[setId] = {};
      for (const [optionId, count] of Object.entries(setCounts)) {
        if (typeof count === "number" && Number.isFinite(count)) {
          counts[setId][optionId] = count;
        }
      }
    }
  }

  return {
    totalSubmissions:
      typeof value.totalSubmissions === "number" ? value.totalSubmissions : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
    counts,
  };
};
