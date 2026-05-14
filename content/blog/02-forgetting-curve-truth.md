# The Forgetting Curve Truth: Why Cramming Fails, How Spaced Repetition Works, and What FSRS Actually Fixes

**By Alfred So, Founder of XueBaOS**
**Published: [Date] | Reading Time: 10 minutes**

---

Every student knows the feeling. You study for hours. You close the textbook feeling confident. You walk into the exam. You stare at question 1. And the answer — the answer you *know* you studied — is gone. Vaporized. Nowhere to be found.

This isn't a personal failing. It's not anxiety. It's not "exam brain." It's the forgetting curve — and it's as predictable as gravity.

The good news: once you understand it, you can defeat it. The better news: we now have algorithms that predict exactly when to intervene. Here's everything you need to know.

---

## Ebbinghaus and the Discovery That Should Have Changed Education

In 1885, Hermann Ebbinghaus — a German psychologist with no university position, no lab, and no research subjects except himself — published one of the most important papers in the history of cognitive science.

His method was almost comically simple. He created 2,300 nonsense syllables (e.g., "ZOF," "WUX," "DAK") and memorized them in lists. Then he tested himself at various intervals: after 20 minutes, after 1 hour, after 1 day, after 1 week, after 1 month. He recorded how many syllables he could recall and plotted the results.

What he found is now called the **Ebbinghaus Forgetting Curve**:

| Time Since Learning | Approximate Retention |
|---------------------|----------------------|
| Immediately | 100% |
| 20 minutes | 58% |
| 1 hour | 44% |
| 9 hours | 36% |
| 1 day | 33% |
| 2 days | 28% |
| 6 days | 25% |
| 31 days | 21% |

The curve is steepest at the beginning. You lose the most information in the first hour after learning. You lose almost half within 20 minutes. After about a week, the decay slows — and you're left with roughly 20-25% of what you originally encoded.

Let that sink in: **after a typical study session, you retain about one-fifth of what you studied a month later.** The other 80% of your study time — the hours of highlighting, re-reading, note-taking — produced memories that dissolved within days.

This is not controversial. It's been replicated hundreds of times over 140 years. The forgetting curve is one of the most robust findings in psychology.

And yet, most students study as if it doesn't exist.

---

## Why Your Brain Forgets (It's Not a Bug — It's a Feature)

Your brain doesn't forget because it's broken. It forgets because it's efficient.

From an evolutionary perspective, forgetting is adaptive. Your ancestors didn't need to remember every leaf they saw or every sound they heard. They needed to remember: where the water is, which berries are poisonous, what the predator's tracks look like. Information that is rarely accessed is deprioritized. Information that is frequently accessed is strengthened.

This is the **use-it-or-lose-it** principle of memory. Neural connections that fire together wire together (Hebb's Law). Connections that don't fire are pruned. Your brain is constantly asking: "Have I needed this recently? If not, let's free up the resources for something else."

The reason the forgetting curve is exponential is that memory decay follows a **power law of practice** — each successive recall attempt strengthens the memory trace, and the strengthening compounds. But in the absence of recall, decay is rapid.

You can't stop forgetting. You can only interrupt it.

---

## Spaced Repetition: The Interrupt Mechanism

Here's the core insight that Ebbinghaus himself discovered: **if you review information just before you're about to forget it, the memory trace is not just restored — it's strengthened.** And the interval before you forget again gets *longer*.

This is spaced repetition:

- **First review:** ~1 day after initial encoding (catch it before it drops below ~40%)
- **Second review:** ~3 days later (the trace is stronger; decay is slower)
- **Third review:** ~1 week later
- **Fourth review:** ~2 weeks later
- **Fifth review:** ~1 month later
- **Subsequent reviews:** Months apart

Each successful recall at the right moment extends the retention interval. After 5-7 well-spaced reviews, information can be retained for years with minimal further maintenance.

The graph is unmistakable. Without intervention, memory decays following the standard forgetting curve — steep initial drop, gradual leveling off at ~20%. With spaced retrieval, each review "resets" the curve at a higher starting point and with a shallower slope. After 4-5 reviews, the forgetting curve is nearly flat.

This is why Cepeda et al. (2008) found that optimal spacing can double retention compared to massed practice (cramming). It's not that spaced repetition makes you "smarter." It's that cramming is actively sabotaging your memory.

---

## The Cramming Trap: Why Last-Minute Studying Feels Effective

If cramming is so ineffective, why does every student do it? Why does it *feel* like it works?

**The illusion of fluency.**

When you review material from 8 PM to 3 AM the night before an exam, the information is fresh in your short-term memory. The next morning, you can recall it. You feel confident. You walk into the exam, regurgitate most of it, and walk out thinking "cramming saved me."

Here's what you don't notice:

1. **You forgot it all within 48 hours.** A week after the exam, you remember almost nothing. For cumulative subjects (math, languages, sciences), this means you're starting from zero for the next unit — while your spaced-repetition classmates are building on a foundation.

2. **You performed worse than you could have.** Even at its best, cramming produces fragile memories that are easily disrupted by stress, fatigue, and interference. On exam day, you're one bad night's sleep away from disaster.

3. **You can't apply or synthesize.** Crammed knowledge is shallow. You can recognize definitions. You can't explain connections, critique arguments, or apply concepts to novel problems — the exact skills that earn top marks.

4. **The stress compounds.** Cramming is stressful. Stress impairs memory consolidation. So you're using a technique that produces fragile memories while simultaneously impairing your brain's ability to consolidate those memories. It's a negative feedback loop.

A 2006 study by Rohrer and Taylor put this to the test. Students learned a mathematical procedure and were tested either 1 week later or 4 weeks later. Some practiced with massed problems (cramming style — all at once). Others practiced with spaced problems (distributed over two sessions). Results:

- **At 1 week:** Massed practice scored slightly higher (72% vs. 70%)
- **At 4 weeks:** Spaced practice scored dramatically higher (70% vs. 42%)

Cramming gave a tiny short-term edge and a catastrophic long-term deficit. The students who spaced their practice retained over 65% more a month later.

For any exam more than 3 days away, cramming is self-sabotage dressed as diligence.

---

## The Algorithm Problem: Why Anki's SM-2 Is Outdated

If you've used Anki — the most popular spaced repetition software — you've benefited from the SM-2 algorithm, developed by Piotr Woźniak in 1987.

SM-2 works like this:
- You rate your recall on a scale (e.g., 1-4)
- The algorithm adjusts intervals based on a fixed formula
- Parameters are the same for every user
- Parameters are the same for every subject

It was revolutionary in 1987. In 2025, it's a horse-drawn carriage.

SM-2 has several fundamental limitations:

### 1. One-Size-Fits-All Intervals
SM-2 uses the same starting interval and ease factor for every user. But forgetting curves vary dramatically between individuals. Some people retain information for weeks after a single exposure. Others lose it in days. SM-2 treats them identically.

### 2. No Adaption to Content Difficulty
A simple fact ("the capital of France is Paris") and a complex concept ("explain the structure of a nephron") get the same scheduling treatment. SM-2 has no way to distinguish between easy and difficult material.

### 3. Subjective Self-Rating
The "Again / Hard / Good / Easy" rating system is fundamentally subjective. What one user calls "Hard," another calls "Good." Your mood, fatigue, and standards drift over time. The algorithm is optimizing on noise.

### 4. No Personalization Over Time
SM-2 adjusts intervals based on your ratings, but the adjustment logic is fixed. If the algorithm overestimates your memory (assigning too-long intervals) or underestimates it (assigning too-short intervals), there's no mechanism to learn from these errors. It keeps making the same mistakes.

---

## Enter FSRS: The Algorithm That Learns You

FSRS (Free Spaced Repetition Scheduler) was developed by Jarrett Ye and published in 2023. It addresses every limitation of SM-2 by treating spaced repetition as a machine learning problem.

Here's how it works, conceptually:

### 1. It Models Your Forgetting Curve
FSRS doesn't assume you have a standard forgetting curve. It learns *your* curve. After you review a few hundred cards, the algorithm has enough data to estimate your personal memory decay rate, your initial retention after a single exposure, and how much each review boosts retention.

### 2. It Uses a Probabilistic Model
Instead of fixed intervals, FSRS calculates the *probability* that you'll recall each item at any given time. You set a target retention rate (default: 90%). The algorithm schedules a review when your predicted recall probability drops to 90%.

If your target is 95%, reviews are more frequent. If you're comfortable at 85%, reviews are less frequent. You control the trade-off between study time and retention level.

### 3. It Optimizes Continuously
FSRS uses gradient descent to optimize its parameters against your actual review history. It learns from its mistakes. If the algorithm predicted you'd have a 95% chance of recalling a card and you failed it, the parameters adjust. Over time, the predictions become increasingly accurate.

### 4. It Handles Content Difficulty
FSRS incorporates item difficulty into the model. Difficult items start with lower initial stability and require more frequent reviews. Easy items get longer intervals from the start. The algorithm allocates your review time where it's most needed.

### 5. It's Published and Peer-Reviewed
Unlike many "AI" claims in edtech, FSRS is transparent. The algorithm, code, and benchmarks are publicly available. Independent researchers can verify the claims.

The results: **FSRS reduces review load by 20-30% compared to SM-2 while maintaining the same retention rate.** Or, equivalently, it achieves higher retention for the same review load. In either configuration, it's a strict improvement.

---

## The Saturation Problem: Why Even Good Spacing Fails

There's a problem that spaced repetition alone doesn't solve: **cognitive saturation.**

Your brain has limited encoding capacity per day. After a certain point, new information doesn't stick — no matter how well you schedule it. This is why 8-hour study marathons produce diminishing returns. Hours 6-8 might be almost completely wasted.

The mechanism is well-understood:

- **Synaptic homeostasis:** During wakefulness, synaptic connections strengthen as you learn. But there's a physical limit — synapses can't strengthen indefinitely. Sleep renormalizes synapses (the synaptic homeostasis hypothesis, Tononi & Cirelli, 2006), but during a single waking day, you hit a ceiling.
- **Glucose depletion:** Sustained cognitive effort depletes glucose in the prefrontal cortex. Decision quality, attention, and encoding efficiency all decline.
- **Proactive interference:** Information learned earlier in the day interferes with information learned later. The more you try to cram in, the more the items compete for the same neural real estate.

This is why XueBaOS's Timetable Optimizer incorporates *saturation management*:

- Subjects rotate before fatigue sets in (typically 45-90 minute blocks)
- Interleaving schedules prevent proactive interference
- Sleep-constrained scheduling prevents late-night sessions that produce poor encoding
- Buffer zones account for real-world cognitive variability

Spaced repetition tells you *when* to review. Saturation management tells you *how much* to review in a session. You need both.

---

## The Practical Protocol: How to Actually Use Spaced Repetition

Here's an evidence-based study protocol that integrates everything we've covered:

### Phase 1: Initial Encoding (Day 0)
- **Duration:** 25-45 minutes per topic
- **Method:** Build a memory palace (XueBaOS automates this) or create your encoding structure
- **Do NOT:** Re-read passively or highlight without active engagement
- **Goal:** Create a spatial or associative structure for the information — not to "remember it perfectly"

### Phase 2: First Retrieval (Day 1)
- **When:** 24 hours after initial encoding
- **Method:** Walk through your memory palace. Try to recall each item without looking. Only check after attempting recall.
- **Duration:** 10-15 minutes per palace
- **Why:** The first retrieval is critical — it interrupts the steepest part of the forgetting curve

### Phase 3: Scheduled Retrieval (Ongoing)
- **When:** Let FSRS determine this. You'll typically see intervals expanding: 1 day → 3 days → 7 days → 16 days → 35 days → 2 months...
- **Method:** Active recall each time. Do not passively review.
- **Rule:** Trust the algorithm. If it says "review now," review now. If it says "not yet," don't prematurely review — you're wasting effort on something you haven't forgotten.

### Phase 4: Deep Testing (Weekly)
- **Method:** Use Deep+Wide questions that require application, analysis, and synthesis — not just recall
- **Why:** Recall ≠ understanding. The testing effect (Roediger & Karpicke, 2006) shows that retrieval practice during testing further strengthens memory.

### Phase 5: Pre-Exam Consolidation (Last 2 Weeks)
- **Review:** All palaces, prioritizing high-weight topics
- **Test:** Full-length practice papers under timed conditions
- **Adjust:** FSRS will naturally compress review intervals as exam approaches if you set an exam date target

---

## Why This Matters for DSE, IB, and A-Level Students

Let's make this concrete for the exams that matter to XueBaOS's users.

**DSE:** You're studying 6-7 subjects over 2.5 years (F.4–F.6). That's roughly 200 weeks. If you use spaced repetition from F.4, information encoded in Term 1 of F.4 can be maintained with very sparse reviews (every few months) by F.6 exam season. If you cram everything in the last 3 months, you're trying to encode 2.5 years of content into a system that loses 80% within days.

**IB:** The two-year program covers the syllabus comprehensively, but most schools finish content delivery ~2 months before exams. That leaves you 2 months to consolidate 18 months of learning. With spaced repetition, you've been consolidating all along. Without it, you're facing a review mountain with rapidly decaying tools.

**A-Level:** Similar structure — AS content is tested at the end of Year 12, A2 at the end of Year 13. But A2 exams are cumulative. If you haven't maintained your AS knowledge, you're re-learning before A2 exams while also trying to learn A2 content.

The pattern is universal: **exams reward long-term retention. Students rely on short-term cramming. The gap between these two realities is where grades go to die.**

---

## The Bottom Line

The forgetting curve is not an opinion. It's a measurement. You don't get to negotiate with it. You don't get to "study harder" and make it go away. You can only do what Ebbinghaus discovered 140 years ago: **interrupt it at the right moments, repeatedly, until the memory stabilizes.**

Spaced repetition is the "how."
FSRS is the "when, precisely."
The memory palace is the "encode well so there's something worth spacing."

All three together — that's the system.

---

[Start Building Memory Palaces With Built-In FSRS — Free →](https://xuebaos.ai)

---

## References

- Cepeda, N. J., et al. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102.
- Ebbinghaus, H. (1885/1913). *Memory: A Contribution to Experimental Psychology.*
- Karpicke, J. D., & Roediger, H. L. (2008). The critical importance of retrieval for learning. *Science, 319*(5865), 966–968.
- Rohrer, D., & Taylor, K. (2006). The effects of overlearning and distributed practise on the retention of mathematics knowledge. *Applied Cognitive Psychology, 20*(9), 1209–1224.
- Tononi, G., & Cirelli, C. (2006). Sleep function and synaptic homeostasis. *Sleep Medicine Reviews, 10*(1), 49–62.
- Ye, J., et al. (2023). FSRS: A modern, efficient spaced repetition algorithm. *arXiv.*
