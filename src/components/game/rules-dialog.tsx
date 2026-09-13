import { useState } from "react";
import { Spectrum } from "./spectrum";
import { COPY } from "@/lib/game/copy";
import { scoreNeedle } from "@/lib/game/scoring";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const DEMO_TARGET = 0.77;
const DEMO_CLUE = "去超商買飲料時雨傘被幹走了";

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [needle, setNeedle] = useState(0.5);
  const [revealed, setRevealed] = useState(false);
  const [exampleView, setExampleView] = useState<"channeler" | "devotee">("channeler");
  const demoScore = scoreNeedle(needle, DEMO_TARGET);
  const showExampleTarget = exampleView === "devotee";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="關閉"
        onClick={onClose}
      />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(42,24,16,0.2)] sm:rounded-[24px] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-primary">問事須知</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">{COPY.rules}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink"
            aria-label="關閉"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ink">
          <p>
            每回合會指派一位玩家為<strong>{COPY.devotee}</strong>。並出現一條光譜，只有這回合的信眾知道答案藏在哪裡。
          </p>
          <div className="rounded-[16px] bg-surface px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] tracking-[0.18em] text-muted">例如</p>
              <ViewToggle value={exampleView} onChange={setExampleView} />
            </div>
            <Spectrum
              leftLabel="完全沒生氣"
              rightLabel="氣到不行"
              interactive={false}
              targetCenter={showExampleTarget ? DEMO_TARGET : null}
              showBands={showExampleTarget}
            />
          </div>
          <p>
            信眾根據光譜上的答案出一個線索給其他<strong>{COPY.channeler}</strong>
            ，線索不能直接說出答案的位置。通靈者猜得越靠近目標越高分，最高 3 分。推薦面對面玩，也可以進行視訊，這裡沒有內建語音。
          </p>
          <ul className="space-y-2 rounded-[16px] bg-surface p-4 text-sm">
            <li>
              <strong>3–8 人：</strong>信眾得到所有通靈者該局分數的加總。每人當一次信眾後結算。最高分是
              {COPY.master}，最低分是{COPY.lastPlace}。
            </li>
            <li>
              <strong>2 人：</strong>兩人輪流當信眾，規則同上。若這題通靈者有得分，信眾也得 1 分；沒人得分則信眾 0 分。遊戲直到有人按「
              {COPY.settleDuo}」才結束。
            </li>
          </ul>
          <p className="text-sm text-muted">信眾出的線索盡量不要有數字</p>

          <div className="rounded-[20px] bg-surface p-4 pt-5">
            <p className="mb-1 text-sm font-medium">試試看指針</p>
            <div className="mb-4 rounded-[14px] bg-bg px-3 py-2.5 text-center">
              <p className="text-[11px] tracking-[0.18em] text-muted">本次問事（信眾出的）</p>
              <p className="mt-1 font-display text-base font-semibold leading-snug">{DEMO_CLUE}</p>
            </div>
            <Spectrum
              leftLabel="完全沒生氣"
              rightLabel="氣到不行"
              needle={needle}
              onNeedleChange={setNeedle}
              interactive={!revealed}
              locked={revealed}
              targetCenter={revealed ? DEMO_TARGET : null}
              showBands={revealed}
            />
            {revealed && (
              <p className="mt-3 text-center font-display text-lg font-semibold">獲得 {demoScore} 分</p>
            )}
            <div className="mt-4">
              <Button
                variant={revealed ? "secondary" : "primary"}
                className="w-full"
                onClick={() => {
                  if (revealed) {
                    setRevealed(false);
                    setNeedle(0.5);
                  } else {
                    setRevealed(true);
                  }
                }}
              >
                {revealed ? "再試一次" : "示範揭曉"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: "channeler" | "devotee";
  onChange: (v: "channeler" | "devotee") => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-[11px] font-medium">
      <button
        type="button"
        onClick={() => onChange("channeler")}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          value === "channeler" ? "bg-surface text-ink shadow-[0_0_0_1px_rgba(42,24,16,0.08)]" : "text-muted",
        )}
      >
        通靈者視角
      </button>
      <button
        type="button"
        onClick={() => onChange("devotee")}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          value === "devotee" ? "bg-surface text-ink shadow-[0_0_0_1px_rgba(42,24,16,0.08)]" : "text-muted",
        )}
      >
        信眾視角
      </button>
    </div>
  );
}

export function RulesButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" className={className} onClick={() => setOpen(true)}>
        {COPY.rules}
      </Button>
      <RulesDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
