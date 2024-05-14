#!/usr/bin/env node
import inquirer from "inquirer";
import { getUrl, setup } from "./utils.js";

const choice = await inquirer.prompt({
    name: 'entry',
    message: 'What would you like to do?',
    type: 'list',
    choices: [
        'Add to RSS',
        'Setup',
        'Exit'
    ]
})

if (choice.entry === 'Setup') {
   setup()
} 
else if (choice.entry === 'Add to RSS') {
   getUrl()
} else if (choice.entry === 'Exit') {
    process.exit()
}


