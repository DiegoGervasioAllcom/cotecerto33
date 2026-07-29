import { groupTutorialChapters } from "./tutorial-content-group";
import { matrizTutorialChapters } from "./tutorial-content-matriz";
import { salesTutorialChapters } from "./tutorial-content-sales";
import { defineTutorial } from "./tutorial-targets";

export const tutorialDefinitions = {
  sales: defineTutorial("sales", salesTutorialChapters),
  matriz: defineTutorial("matriz", matrizTutorialChapters),
  group: defineTutorial("group", groupTutorialChapters),
};
