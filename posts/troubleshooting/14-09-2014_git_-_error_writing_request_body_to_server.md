When I decided to setup my own git server, I ran into a small problem: I was unable to push binaries to a repository. This was strange as I had never ran into a problem similar to this. The error message that had shown up in my IDE had no information on it, only telling me "Error writing request body to server". With the help of some google-fu, I was able to find a simple fix


Git Command
--

```
# Fix for HTTPS connections
git config https.postBuffer 524288000 

# Fix for HTTP connections
git config http.postBuffer 524288000
```

These commands fixed the issue, but I am not sure why this does. I have never had a problem like this using publicly hosted git servers (IE: GitHub) and I do not know if this is the best solution.

Eclipse Setting
--

To fix this in Eclipse edit the settings in Team > Git > Configuration by using the "Add Entry..." button. Set the key to "http(s).postBuffer" and the value to "524288000"
