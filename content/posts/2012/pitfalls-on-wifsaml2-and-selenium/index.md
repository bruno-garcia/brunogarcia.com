---
title: "Pitfalls on WIF+SAML2 and Selenium"
date: 2012-12-12T21:39:00.000+01:00
tags: ["C#", "SAML", "Selenium", "Security"]
author: "Bruno Garcia"
showToc: false
draft: false
aliases:
  - /blogger/2012/pitfalls-on-wifsaml2-and-selenium/
description: "Common pitfalls when using Windows Identity Foundation with SAML2 tokens and automating authentication flows with Selenium."
---

## WIF and SAML 2.0

First some background: There is a [known issue](http://social.msdn.microsoft.com/Forums/en-SG/Geneva/thread/ec4ea486-6a78-4b49-b66b-353144b52d0b) on WIF (Windows Identity Foundation) for SAML 2.0 that generates cookies with a name being a GUID and the value, base64 encoded data that grows every SAMLRequest the module handles. The decoded value looks like: `0;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15`

It starts with small ones but get really, really large.

![WIF SAML2 GUID cookies](wif-saml2-guid-cookies.png)

Every client gets one of these cookies and each time they are bigger, to the point that when they are sent back to the server, an HTTP error is thrown: `HTTP 400 - Bad Request (Request Header too long)`

This [msdn link](http://social.msdn.microsoft.com/Forums/en-SG/Geneva/thread/ec4ea486-6a78-4b49-b66b-353144b52d0b) has a comment with the first steps to take in case you end up with this problem. They are very straight forward and we did them even before ending up on that msdn page. Regarding their forth step (final "fix"), in our case, it was decided a different solution.

The solution here was to remove the cookies before they would be sent out to the user in the first place. This way, even though for some really short time the cookie existed in memory at the server, the client never got to know of its existence. To achieve that, login and logout gotta be changed. That is: `SignIn` and `RedirectingToIdentityProvider` events from the `Saml2AuthenticationModule`. At that point in the event pipeline, the underlying Microsoft WIF code had already added the cookies to the Response, which gives us opportunity to remove them before the headers are sent out to the client.

## Which takes us to Selenium

The final solution had to be tested before dropping new build to production. And to test it, we had to reproduce it. The issue was not known during Dev or QA phases/environments, it did not happen, so the first step was to be able to reproduce it on a controlled environment.

Basically the idea was to use Selenium to simulate few dozens of users logging in and off in parallel until a cookie matching a GUID (plus a number?) would be received by one of the clients. There was no need to let it grow to the point of having: `HTTP 400 - Bad Request (Request Header too long)`

For that, I wrote a small application to spawn a thread for each `IWebDriver` (threads from the pool were conflicting the Drivers), each logging in with a different user account, removing the cookies (so user would be challenged again) and starting over.

The code would detect the existence of the cookie and stop the test, but to make visible (the cookies in and out) we can load Selenium driver with Firebug enabled and the cookie tab enabled and visible as default.

That goes like:

```csharp
const string firebug = @"firebug-1.10.6-fx.xpi";
IWebDriver driver;
if (includeFireBug && File.Exists(firebug))
{
    var profile = new FirefoxProfile();
    profile.AddExtension(firebug);
    // Set default Firebug preferences
    profile.SetPreference("extensions.firebug.currentVersion", "1.10.6");
    profile.SetPreference("extensions.firebug.allPagesActivation", "on");
    profile.SetPreference("extensions.firebug.defaultPanelName", "cookies");
    profile.SetPreference("extensions.firebug.net.enableSites", true);
    profile.SetPreference("extensions.firebug.cookies.enableSites", true);
    driver = new FirefoxDriver(profile);
}
```

I mentioned the code would check the cookies to look for the GUID one, and with Selenium API, it's very simple to do so:

```csharp
Guid test;
if (driver.Manage().Cookies.AllCookies.Any(p => p.Name.Length >= 37 
    && Guid.TryParse(p.Name.Substring(0, 36), out test)))
{
    // ...
}
```

Just checked if it's big enough to be GUID, then tried to parse the GUID part of it (note it appends some number to sequentially divide them into 2k sized each).

Two domains involved in this test. The service provider, let's call: *service.com* and the identity provider: *idp.com*

Initially I set the `IWebDriver` Url property to the service provider: *service.com*. Find the element for Login and fire a click. That would call the SAML module that would redirect the client to the identity provider: *idp.com*

The login and password input elements would be filled up and login button triggered in the IdP page. At this point, the session cookie from the IdP was sent to the browser, under *idp.com* domain, and client redirected back to *service.com*. SAML flow finished and session cookies from *service.com* also sent to the client.

That's all we need to reproduce the issue. However, these steps had to be done over and over, several times until the issue would happen. Particularly in our case, Logout was not possible since the accounts used were test account and thus not validated, so simply deleting the cookies would enable us restart the flow (and save us some requests/time). But this means deleting cookies from both *service.com* and *idp.com*.

Using Selenium API, I wrote:

```csharp
driver.Manage().Cookies.DeleteAllCookies();
```

Even though the method is called `DeleteAllCookies`, it deletes *all* cookies from the **current domain** on which the WebDriver is located. In this case, *service.com*, since user just landed after the SAML login. Looping the Cookies collection from within the WebDriver obviously would return only the cookies from the current domain.

It was the time for a second maneuver: Setting the Url property of the WebDriver to anywhere under the *idp.com* domain that wouldn't return with a redirection, and call again `DeleteAllCookies`. That simple. I browsed the root of the domain, without any resource id, which returned `403.14 - Directory listing denied`. That was enough to run a code like:

```csharp
// right after login flow finished (landed on service.com, logged in)
driver.Manage().Cookies.DeleteAllCookies(); // deletes service.com cookies
driver.Url = "idp.com";
driver.Manage().Cookies.DeleteAllCookies(); // deletes idp.com cookies
```

After that the flow could be re-initiated. After few hundreds of times, we could reproduce the issue, add the fix, run the test again with thousands of logins, without any issues.
