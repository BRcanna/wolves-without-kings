# Deep Dive — Police Case Engine

The police system should feel like institutions building partial knowledge over time, not supernatural stars that know exactly where the player is.

## Event versus case

A crime event is world truth. A police case is an institutional record assembled from evidence.

The police may never learn about an event. They may learn only part of it. They may connect several events incorrectly. They may know the event occurred but not know the offender.

## Case state

```text
Case
  lead agency
  jurisdiction
  stage
  incidents linked
  suspects
  evidence
  witness statements
  confidence/priority
  authorized actions
  resource allocation
  prosecutor/court relationships where applicable
  last activity
  cold/active/closed state
```

## Evidence families

Keep these at an abstract game level:

- witness testimony;
- camera observation;
- vehicle association;
- weapon/object association;
- property/access records;
- communications/document evidence;
- financial/business anomalies;
- physical trace abstractions;
- informant claims.

Each evidence item has provenance and a confidence/admissibility interpretation. The system does not need to simulate a forensic lab in molecular detail.

## Witnesses

Witnesses are belief-bearing people. They can:

- see only part of an event;
- misidentify;
- refuse to speak;
- speak cautiously;
- lie;
- be intimidated;
- later remember something;
- be contradicted;
- have credibility issues;
- be protected or unavailable.

Authoritative world truth is never rewritten to match testimony.

## Agencies

Different institutions possess different authority and information. Local police, specialized organized-crime investigators, border/customs functions, prosecutors, courts and corrections should not collapse into one omnipotent actor.

A corrupt patrol officer may warn the player about a local stop. That does not grant the officer power to erase evidence held elsewhere.

## Investigation adaptation

Investigators can learn patterns from observed history using the SOCOM_REACT-style bounded adaptation concept.

Repeated behaviors can change patrols or surveillance focus only after enough evidence. The system must preserve a difference between:

```text
engine knows player always uses Route A
police have observed player using Route A enough times
```

Only the second can change police planning.

## Heat without a heat meter

The player needs feedback. Use qualitative signals:

- patrol frequency;
- known associates being questioned;
- a contact warning the player;
- surveillance vehicles;
- business inspections;
- newspaper coverage;
- police visits;
- warrants/arrest attempts;
- lawyer dialogue.

Debug can show numerical case state, but release UI should not need five wanted stars.

## Going cold

Cases can lose active resources if evidence stalls, but they do not necessarily forget history. A future weapon, witness or linked incident can reactivate an old case.

That creates the possibility of a player thinking a 2002 event is gone until it returns in 2007.

## Arrest

Arrest is a transition into legal/prison systems. It can occur after surrender, injury, traffic stop, raid, warrant service or other systemic event. The exact court process can be compressed and fictionalized, but consequences should derive from case/evidence state rather than a random sentence roll.
