---
title: "NuGetTrends: .NET libraries download trends"
date: 2019-07-16T22:47:00.001+02:00
tags: [".NET", "NuGet", "Open Source"]
author: "Bruno Garcia"
showToc: false
draft: false
aliases:
  - /blogger/2019/nugettrends-net-libraries-download/
description: "Introducing NuGet Trends — a web app to compare and visualize .NET library download statistics from NuGet.org over time."
---

I joined [sentry.io](https://sentry.io/) just over a year ago. Soon after I started, I was tasked with writing a [new .NET SDK for Sentry](https://www.nuget.org/packages/Sentry).

Throughout the previews, I was always curious if the releases were being downloaded at all.

I found myself checking [nuget.org](https://nuget.org/) and looking at the `Statistics` for `total downloads`. It was obvious we in the .NET ecosystem were missing some package download stats website.

**Welcome [NuGet Trends](https://nugettrends.com/), to the .NET community!**

NuGet Trends is a website with historical total download count for NuGet packages on [nuget.org](https://nuget.org/).

There's data since **2013** which was contributed by [ZZZ projects](https://zzzprojects.com/), the company behind the [EF Extensions](https://entityframework-extensions.net/). Shout out to Jonathan! Thanks a lot! Unfortunately there's a gap in 2017 of about 10 months, though.

Also, the UI so far has predefined filter for as far back as 2 years and result is grouped by week. Query string takes months as an integer though so URL hack to have some fun.

The **NuGet Trends** workers go through the [nuget.org](https://nuget.org/)'s catalog API so all the package's metadata are available in its database. That means there's the potential to build some new cool stats like:

- How many packages are signed.
- Are the DLLs in the packages strong named.
- Packages with unoptimized DLLs.
- Stats package adoption of [source link](https://docs.microsoft.com/en-us/dotnet/standard/library-guidance/sourcelink).
- [TFM adoption](https://docs.microsoft.com/en-us/nuget/reference/target-frameworks#supported-frameworks) (ran some queries for this and it's great how .NET Standard 2.0 picked up fast).

For some of those features we'd still need to download the actual packages and inspect its contents. There's some work there but this is the call for help!

Code's on GitHub: [https://github.com/NuGetTrends/nuget-trends](https://github.com/NuGetTrends/nuget-trends)

Thanks to the contributors: [https://github.com/NuGetTrends/nuget-trends/graphs/contributors](https://github.com/NuGetTrends/nuget-trends/graphs/contributors)

We're [online on Gitter](https://gitter.im/NuGetTrends/Lobby), if you'd like to chat.

It'd be great to get some help too!

Let's build something cool out of this? It would be great to see that contributors list grow.
