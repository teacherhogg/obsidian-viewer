
# Quiz Feature

I am wanting to include a quiz feature as a part of this project. The quiz feature is intended to be an add-on to any article in a vault where the user can click a button that says "Quiz Me" and a series of questions will be presented to test the user of their knowledge of the article in question.

## Here is a few specific suggestions:

1) When the "Quiz Me" is clicked, check to see if a quiz has previously been created (saved in a json file) and if so, start that one again. Otherwise create a new quiz.
2) If the Quiz has been run before, then indicate the date last run and the last score in the header of the article (much like what is done now with last time read).
3) If the quiz has never been run, it needs to get generated based on the information in the article when the "Quiz Me" button is clicked. 
4) The "quiz" itself will be a json file stored in the same folder as the article with the same name but a .json extension (this is a suggestion - but open to other possibilities).

## Quiz Requirements:

For now I want the following question types to be supported in quizzes:

* MC (Multiple Choice)
* MS (Multiple Select)
* QA (Question and Answer)

### For all question types the following will be the flow for each quiz:

1) Quiz will tell you what question number you are on out of the total number of questions.
2) The question will be shown. For MC and MS questions, the user will choose an answer and then select the Next button. For the QA question there is just the question and no way to provide an answer, just the Next button (the user will just think of their answer in their mind).
3) The next screen will indicate the correct answer (for MC and MS) and indicate if the user got it wrong or right. For a QA question, the correct answer will be shown and then the ability to indicate if the user feels they had it right or wrong. The user then hits Next again when ready to proceed to the next screen.
4) The end of the quiz will give a summary screen which includes the user's score.

### Quiz Question Formulation

The actual generating of quiz questions will require calling an AI. This should be configurable, but for now we will start with Claude API. The miraprompt project (/home/dwhogg/Projects/miraprompt) is already intimately related to this project and the services associated with that project (like obsidian-watcher, miraprompt-server,...) will be running and available. If it makes most sense to make this quiz question generation utility in the miraprompt project rather than a separate AI configuration in THIS project, then that is fine. Whatever is cleanest and simplest.

When I say the use of an AI should be configurable, that is both the AI model itself as well as the prompt(s) used to generate the questions should be in a settngs json file somewhere so they can be tweaked later if need be.

Quiz questions themselves should include:

* 5-10 questions (based on amount of information in the article).
* Include questions about any new specific terms referred to in the article (like, "Define the term XXXX" or "Explain what XXXX means")
* Include questions asking about specific lists or components or relations to some concept introduced (like "What are 3 key components of BLAH")
* Questions that probe a person's understanding of the overall and key themes in the article.
* Include a mix of question types. Make the system work if we introduce a NEW question type later on (so it isn't hardcoded to the three types we have - but will naturally expand to include new ones).


## A few more things to note:

1) Would probably make sense to extend the backend database used in miraview-server to keep track of when a quiz was last run and the last score obtained (score and total - like 7/10 for example).
2) Checkout the project at /home/dwhogg/Projects/idealism/idealism-sandbox. This project is another project that I had started making a quiz feature that used Vue components and a pinia store to save the quiz progress. This is a different idea in that the quiz progress is saved locally whereas in this new quiz feature the progress should be saved as a part of the user's data on the server. However, IF the Vue implementation looks like a good starting point for THIS quiz project, then feel free to use that. Ideally I would like to have a quiz solution that I can use in BOTH this project and the idealism-sandbox project (although again - storing user progress and info will be local in the later and on the server for this project). You can look at example quiz json format for that project for ideas in the docs/store/defaults.json and /docs/store/scenarios.json files.

Let me know if you have any questions or concerns about this new feature.