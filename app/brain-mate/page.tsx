import OpenOnMap from "@/components/brainMate/OpenOnMap";

/** Brain-Mate is played over the home map; this address keeps its link preview. */
export default function BrainMateLanding() {
  return <OpenOnMap to="/?bm=play" />;
}
