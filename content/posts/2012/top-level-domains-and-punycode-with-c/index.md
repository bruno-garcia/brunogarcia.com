---
title: "Top level domains and punycode with C#"
date: 2012-11-10T23:37:00.000+01:00
tags: ["C#", "Network"]
author: "Bruno Garcia"
showToc: false
draft: false
cover:
    image: "punycode.png"
    relative: true
    small: true
aliases:
  - /blogger/2012/top-level-domains-and-punycode-with-c/
description: "Working with internationalized domain names (IDN) and Punycode encoding in C# for top-level domain validation."
---

[Punycode](http://en.wikipedia.org/wiki/Punycode) is used to encode Unicode characters into ASCII for [IDN (Internationalized domain name)](http://en.wikipedia.org/wiki/Internationalized_domain_name).

On the [RFC 3492](http://www.ietf.org/rfc/rfc3492.txt) you'll find:

> *"Punycode is a simple and efficient transfer encoding syntax designed for use with Internationalized Domain Names in Applications (IDNA). It uniquely and reversibly transforms a Unicode string into an ASCII string."*

Now if you are looking for validating TLD (Top level domains), you must have that information in mind. The [ICANN list of TLD](http://data.iana.org/TLD/tlds-alpha-by-domain.txt) also contains the IDN ccTLD that started to be included in 2010.

Some Punycode encoded examples from that list:

```
XN--0ZWM56D
XN--11B5BS3A9AJ6G
XN--3E0B707E
XN--45BRJ9C
XN--80AKHBYKNJ4F
XN--80AO21A
XN--90A3AC
XN--9T4B11YI5A
XN--CLCHC0EA0B2G2A9GCD
XN--DEBA0AD
XN--FIQS8S
XN--FIQZ9S
```

The prefix `XN--` makes it easier to identify the Punycode encoded strings.

Luckily since version 2.0, the .Net Framework offers a class to deal with IDN (Punycode and the Nameprep it has to do prior to encoding):

`System.Globalization.IdnMapping`

My goal was to receive a TLD (string) and validate it against the ICANN list of TLD. My first snippet threw an exception on line 4:

```csharp
var tld = ".ਭਾਰਤ";
if (Regex.IsMatch(tld, @"[^\u0000-\u007F]"))
{
    tld = _IdnMapping.GetAscii(tld);
}
```

Exception message was: **IDN labels must be between 1 and 63 characters long.**

My speed reading techniques are quite bad.. In fact I don't have any. Sometimes I just focus on what I believe to be the most important part of the message (in this case "1 and 63 chars long" which didn't make sense) and I ended up missing something important (**IDN labels**).

I googled the exception, finding only these very useful (?!?) [Exception translation websites](https://web.archive.org/web/2014/http://www.errortoenglish.com/pt-pt/W4Y3A1Y5/IDN-labels-must-be-between-1-and-63-characters-long.aspx) and nothing more.

Only to better read the message and realize that the catch was that `IdnMapping` works with [domain name labels](https://www.icann.org/en/icann-acronyms-and-terms):

> *"A constituent part of a domain name. The labels of domain names are connected by dots. For example, "www.iana.org" contains three labels — "www", "iana" and "org". For internationalized domain names, the labels may be referred to as A-labels and U-labels."*

Therefore, my input was simply broken considering it started with a dot. If you are looking to validate the complete list of TLD, including ccTLD, or even the complete domain with multiple labels supporting IDN, the `IdnMapping` class is a go. However, make sure your code does not have leading or trailing dots by having it `Trim('.')` or something.

![Punycode](punycode.png)

Regarding the IDNA versions, on the .Net framework prior to version 4.5 works with version 2003. Now if you are running [.Net Framework 4.5 on Windows 8, the IDNA 2008](http://msdn.microsoft.com/en-us/library/system.globalization.idnmapping.aspx) will be used.
