#!/usr/bin/env node
import inquirer from "inquirer";
import { addToRSS, downloadMP3, getUrl, isYouTubeURL, setup } from "./utils.js";


const choice = await inquirer.prompt({
    name: 'entry',
    message: 'What would you like to do?',
    type: 'list',
    choices: [
        'enter a url',
        'setup',
    ]
})

if (choice.entry === 'setup') {
   await setup()
} 
else if (choice.entry === 'enter a url') {
   await getUrl()
}


