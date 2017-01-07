Everyone in IT knows that stuff, somehow, manages to break whenever you are away from your work/workstation. That never leads to good situations. If one of my services falls offline, I need to know so I can fix it. I needed a quick solution to that problem.

Solutions
---

There are many industry standards for fixing this problem. One of the larger players is nagios. My main problem is I (1) didn't have any server that could run it, (2) didn't need all of its features, and (3) have never worked with the software. I decided to write a simple and smaller solution for my issue: Checkers. It is easy to use, simple to setup, and a fun fix to a large problem of mine.

Setup Checkers
---

* git clone https://github.com/gravypod/Checkers.git
* Edit the config.php with settings you would like.
* Put emails into the EMAILS file you have set in the config. Prefixing with "http://" will get the file from a website.
* Setup a cronjob.
* Sit back and relax.... until you get the email!

Wait...?
---

One feature that many people want in software like this is the ability to receive text messages. Lucky for us, for reasons undisclosed to me, most cell providers support email servers as text message gate ways. "Say what?" some of the readers may have said, but it is OK since it isn't currently, to my knowledge being abused by spammers.


How does it work you say?
---

Simple! Send an email to (phone number)@(provides's email gateway).com

For Version it is as follows: 5555555555@vtext.com

If you do not use Verizon, there is a handy [list of addresses to carriers](http://archive.is/3TnNP). 
