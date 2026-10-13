import React from "react";
import { Play } from "lucide-react";
import type { IssueItem } from "@/lib/api/types";

export function VideoPlayer({
  video,
  time,
  setTime,
  selected,
  select,
  issues,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  time: number;
  setTime: (n: number) => void;
  selected: number;
  select: (n: number) => void;
  issues: IssueItem[];
}) {
  return (
    <div className="player">
      <div className="video-frame">
        <video ref={video} controls aria-label="فيديو إعلان مكمّل غذائي">
          <source src="" />
        </video>
        <div className="video-placeholder">
          <Play />
        </div>
        <span className="now">00:{String(time).padStart(2, "0")}</span>
      </div>
      <div className="timeline">
        <div className="fill" style={{ width: `${(time / 40) * 100}%` }} />
        {issues.map(
          (issue, i) =>
            issue.time !== null && (
              <button
                key={`${issue.id}-${i}`}
                className={`marker ${issue.type} ${selected === i ? "selected" : ""}`}
                style={{ insetInlineStart: `${(issue.time / 40) * 100}%` }}
                aria-label={`${issue.type === "v" ? "مخالفة" : "تنبيه"} عند 00:${String(issue.time).padStart(2, "0")}`}
                onClick={() => select(i)}
              />
            ),
        )}
      </div>
      <div className="times">
        <span>00:00</span>
        <span>00:40</span>
      </div>
      <div className="legend">
        <span>
          <i className="red-dot" /> مخالفة
        </span>
        <span>
          <i className="amber-dot" /> تنبيه
        </span>
      </div>
    </div>
  );
}
