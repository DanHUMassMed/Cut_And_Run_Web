import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineStats, TaskRecord } from "../types/api";

export interface PipelineStreamState {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  runName: string | null;
  stats: PipelineStats;
  tasks: TaskRecord[];
  logs: string[];
  startTime: number | null;
  endTime: number | null;
  elapsedSeconds: number;
  connected: boolean;
  clearLogs: () => void;
  refreshFromStatus: (snapshot: {
    status: "idle" | "running" | "completed" | "failed" | "cancelled";
    run_name: string | null;
    stats: PipelineStats;
    tasks: TaskRecord[];
    start_time: number | null;
    end_time: number | null;
  }) => void;
}

const INITIAL_STATS: PipelineStats = {
  total: 0,
  submitted: 0,
  running: 0,
  completed: 0,
  cached: 0,
  failed: 0,
  percent: 0,
  run_name: null,
};

interface StreamEventPayload {
  type: "init_state" | "log" | "task_update" | "run_started" | "run_completed" | "process_exit";
  status?: "idle" | "running" | "completed" | "failed" | "cancelled";
  run_name?: string | null;
  stats?: PipelineStats;
  tasks?: TaskRecord[];
  task?: TaskRecord;
  line?: string;
  start_time?: number | null;
  end_time?: number | null;
  success?: boolean;
}

export function usePipelineStream(): PipelineStreamState {
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed" | "cancelled">("idle");
  const [runName, setRunName] = useState<string | null>(null);
  const [stats, setStats] = useState<PipelineStats>(INITIAL_STATS);
  const [tasksMap, setTasksMap] = useState<Record<string, TaskRecord>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const refreshFromStatus = useCallback(
    (snapshot: {
      status: "idle" | "running" | "completed" | "failed" | "cancelled";
      run_name: string | null;
      stats: PipelineStats;
      tasks: TaskRecord[];
      start_time: number | null;
      end_time: number | null;
    }) => {
      setStatus(snapshot.status);
      setRunName(snapshot.run_name);
      setStats(snapshot.stats);
      const nextMap: Record<string, TaskRecord> = {};
      for (const t of snapshot.tasks) {
        nextMap[t.key] = t;
      }
      setTasksMap(nextMap);
      setStartTime(snapshot.start_time);
      setEndTime(snapshot.end_time);
    },
    []
  );

  useEffect(() => {
    const es = new EventSource("/api/pipeline/stream");
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as StreamEventPayload;
        if (msg.type === "init_state") {
          if (msg.status) setStatus(msg.status);
          setRunName(msg.run_name ?? null);
          if (msg.stats) setStats(msg.stats);
          if (msg.tasks) {
            const nextMap: Record<string, TaskRecord> = {};
            for (const t of msg.tasks) {
              nextMap[t.key] = t;
            }
            setTasksMap(nextMap);
          }
          setStartTime(msg.start_time ?? null);
          setEndTime(msg.end_time ?? null);
        } else if (msg.type === "log" && typeof msg.line === "string") {
          const line = msg.line;
          setLogs((prev) => (prev.length >= 3000 ? [...prev.slice(-2500), line] : [...prev, line]));
        } else if (msg.type === "task_update") {
          if (msg.task) {
            const updatedTask = msg.task;
            setTasksMap((prev) => ({ ...prev, [updatedTask.key]: updatedTask }));
          }
          if (msg.stats) setStats(msg.stats);
          if (msg.run_name) setRunName(msg.run_name);
        } else if (msg.type === "run_started") {
          setStatus("running");
          if (msg.run_name) setRunName(msg.run_name);
          if (msg.stats) setStats(msg.stats);
          if (msg.start_time) setStartTime(msg.start_time);
          setEndTime(null);
        } else if (msg.type === "run_completed" || msg.type === "process_exit") {
          if (msg.status) {
            setStatus(msg.status);
          } else if (typeof msg.success === "boolean") {
            setStatus(msg.success ? "completed" : "failed");
          }
          if (msg.stats) setStats(msg.stats);
          if (msg.tasks) {
            const nextMap: Record<string, TaskRecord> = {};
            for (const t of msg.tasks) {
              nextMap[t.key] = t;
            }
            setTasksMap(nextMap);
          }
          if (msg.start_time !== undefined) setStartTime(msg.start_time);
          if (msg.end_time !== undefined) setEndTime(msg.end_time);
        }
      } catch {
        // Ignore malformed SSE frames
      }
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    if (!startTime) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const finish = endTime ?? Date.now() / 1000;
      setElapsedSeconds(Math.max(0, Math.floor(finish - startTime)));
    };

    updateTimer();
    if (status === "running" && !endTime) {
      const interval = window.setInterval(updateTimer, 1000);
      return () => window.clearInterval(interval);
    }
    return undefined;
  }, [startTime, endTime, status]);

  return {
    status,
    runName,
    stats,
    tasks: Object.values(tasksMap),
    logs,
    startTime,
    endTime,
    elapsedSeconds,
    connected,
    clearLogs,
    refreshFromStatus,
  };
}
